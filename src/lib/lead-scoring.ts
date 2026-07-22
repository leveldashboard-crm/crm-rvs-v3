// ─── ConnectBuild CRM v3 — Rules-Based Lead Scoring ──────────────────────────
// §3.5: Suggests lead temperature (Hot/Warm/Cold) based on historical patterns.
// Always a SUGGESTION — never auto-applied. Humans stay in the loop.

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export interface LeadScoringInput {
  // Registration data
  status?: string | null;
  countryName?: string | null;
  interactionCount?: number | null;
  lastContactedAt?: Date | string | null;
  // Funnel stage indicators
  bbInvitationStatus?: string | null;
  proofImport?: string | null;
  dollarBusiness?: string | null;
  vujis?: string | null;
  flightHotelCode?: string | null;
  willNotAttend?: string | null;
  // Existing lead temperature (to avoid unnecessary re-scoring)
  currentTemperature?: string | null;
}

export interface LeadScoringResult {
  temperature: LeadTemperature;
  score: number;          // 0–100 raw score
  reasons: string[];      // Human-readable reasoning
  confidence: "high" | "medium" | "low";
}

// ─── Country Tier Definitions ─────────────────────────────────────────────────
// Hot tier: historically high conversion/engagement countries
const HOT_COUNTRIES = new Set([
  "uae", "united arab emirates", "usa", "united states", "uk", "united kingdom",
  "germany", "france", "italy", "spain", "netherlands", "canada", "australia",
  "singapore", "japan", "south korea", "taiwan", "hong kong",
]);

const COLD_COUNTRIES = new Set([
  "sri lanka", "nepal", "bangladesh",
]);

function normalizeCountry(c: string | null | undefined): string {
  return (c ?? "").toLowerCase().trim();
}

function daysSince(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Score a lead based on rules-based heuristics.
 * Returns a temperature suggestion — UI must clearly label this as a suggestion.
 */
export function scoreLead(input: LeadScoringInput): LeadScoringResult {
  let score = 40; // baseline: Warm
  const reasons: string[] = [];

  // ── Disqualification checks (immediate Cold) ──────────────────────────────
  if (input.willNotAttend && input.willNotAttend.trim() !== "") {
    return { temperature: "Cold", score: 0, reasons: ["Marked as Will Not Attend"], confidence: "high" };
  }
  const statusLower = (input.status ?? "").toLowerCase();
  if (statusLower.includes("cancel") || statusLower.includes("decline") || statusLower.includes("not attend")) {
    return { temperature: "Cold", score: 0, reasons: ["Status indicates cancellation or decline"], confidence: "high" };
  }

  // ── Positive signals → add points ────────────────────────────────────────
  // Complimentary flight/hotel → strong buying signal
  if (input.flightHotelCode && input.flightHotelCode.trim() !== "") {
    score += 20;
    reasons.push("Has complimentary travel arrangement (Flight/Hotel)");
  }

  // Verified delegate (proof of import / BL status)
  if (input.proofImport && ["yes","y","verified"].includes(input.proofImport.toLowerCase().trim())) {
    score += 15;
    reasons.push("Import proof verified");
  }
  if (input.dollarBusiness && input.dollarBusiness.trim() !== "") {
    score += 10;
    reasons.push("Dollar business value recorded");
  }
  if (input.vujis && input.vujis.trim() !== "") {
    score += 10;
    reasons.push("VUJIS qualification recorded");
  }

  // BB Invitation status
  const invStatus = (input.bbInvitationStatus ?? "").toLowerCase();
  if (invStatus.includes("sent") || invStatus.includes("accepted") || invStatus.includes("confirmed")) {
    score += 15;
    reasons.push("Invitation accepted/confirmed");
  }

  // Country tier
  const country = normalizeCountry(input.countryName);
  if (HOT_COUNTRIES.has(country)) {
    score += 10;
    reasons.push(`High-engagement country: ${input.countryName}`);
  } else if (COLD_COUNTRIES.has(country)) {
    score -= 15;
    reasons.push(`Lower-priority country: ${input.countryName}`);
  }

  // Interaction count — more contact attempts = warmer
  const interactions = input.interactionCount ?? 0;
  if (interactions >= 5) {
    score += 10;
    reasons.push(`High interaction count: ${interactions} touchpoints`);
  } else if (interactions >= 2) {
    score += 5;
    reasons.push(`Active engagement: ${interactions} touchpoints`);
  }

  // Recency of last contact
  const daysAgo = daysSince(input.lastContactedAt);
  if (daysAgo !== null) {
    if (daysAgo <= 2) {
      score += 10;
      reasons.push("Contacted within last 2 days");
    } else if (daysAgo <= 7) {
      score += 5;
      reasons.push("Contacted within last week");
    } else if (daysAgo > 30) {
      score -= 10;
      reasons.push(`Last contact was ${daysAgo} days ago — at risk of going cold`);
    }
  }

  // ── Clamp score ───────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Map to temperature ────────────────────────────────────────────────────
  let temperature: LeadTemperature;
  if (score >= 70) {
    temperature = "Hot";
  } else if (score >= 40) {
    temperature = "Warm";
  } else {
    temperature = "Cold";
  }

  // ── Confidence level ──────────────────────────────────────────────────────
  let confidence: "high" | "medium" | "low";
  if (reasons.length >= 3 && (score >= 70 || score < 30)) {
    confidence = "high";
  } else if (reasons.length >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  if (reasons.length === 0) {
    reasons.push("Insufficient data — baseline Warm classification");
  }

  return { temperature, score, reasons, confidence };
}

// ─── Badge helpers for UI ─────────────────────────────────────────────────────
export const TEMPERATURE_META = {
  Hot:  { emoji: "🔴", color: "#dc2626", bg: "rgba(220,38,38,0.10)",  label: "Hot Lead"  },
  Warm: { emoji: "🟡", color: "#d97706", bg: "rgba(217,119,6,0.10)", label: "Warm Lead" },
  Cold: { emoji: "🔵", color: "#0071e3", bg: "rgba(0,113,227,0.10)", label: "Cold Lead" },
} as const;
