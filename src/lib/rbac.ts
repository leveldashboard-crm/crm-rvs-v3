// ─── ConnectBuild CRM v3 — Role-Based Access Control ─────────────────────────
// Single source of truth for all role definitions, permission checks, and UI metadata.
// Auth-agent domain: do NOT modify permission logic from outside this file.

// ─── Role Definitions ────────────────────────────────────────────────────────
export const ROLES = [
  "master_admin",
  "regional_admin",
  "team_lead",
  "caller",
  "qa_auditor",
  "analyst",
  // Legacy aliases — kept for backward-compat, mapped to v3 roles at runtime
  "admin",       // → master_admin
  "supervisor",  // → regional_admin
  "user",        // → caller
  "staff",       // → caller
] as const;

export type Role = typeof ROLES[number];

export type V3Role = "master_admin" | "regional_admin" | "team_lead" | "caller" | "qa_auditor" | "analyst";

// ─── Legacy Role Mapping ───────────────────────────────────────────────────────
const LEGACY_MAP: Record<string, V3Role> = {
  admin:      "master_admin",
  supervisor: "regional_admin",
  user:       "caller",
  staff:      "caller",
};

/**
 * Normalize any raw role string (including legacy v1/v2 values) to a v3 V3Role.
 * Always use this before checking permissions.
 */
export function normalizeRole(raw: string | null | undefined): V3Role {
  if (!raw) return "caller";
  const r = raw.trim().toLowerCase();
  return (LEGACY_MAP[r] ?? (isV3Role(r) ? (r as V3Role) : "caller"));
}

function isV3Role(r: string): r is V3Role {
  return ["master_admin","regional_admin","team_lead","caller","qa_auditor","analyst"].includes(r);
}

// ─── Role Hierarchy (numeric level — higher = more privileged) ────────────────
const ROLE_LEVEL: Record<V3Role, number> = {
  master_admin:   100,
  regional_admin:  80,
  team_lead:       60,
  qa_auditor:      50,
  analyst:         40,
  caller:          20,
};

export function roleLevel(role: string): number {
  return ROLE_LEVEL[normalizeRole(role)] ?? 0;
}

export function isAtLeast(role: string, minimum: V3Role): boolean {
  return roleLevel(role) >= roleLevel(minimum);
}

// ─── Permission Helpers ───────────────────────────────────────────────────────

/** Can view the main admin command-center dashboard (KPI + live feed) */
export function canViewDashboard(role: string): boolean {
  const r = normalizeRole(role);
  return ["master_admin", "regional_admin", "team_lead"].includes(r);
}

/** Can view full analytics (AnalyticsPage) */
export function canViewAnalytics(role: string): boolean {
  return isAtLeast(role, "team_lead");
}

/** Can see delegate PII (phone number, email) */
export function canViewPII(role: string): boolean {
  const r = normalizeRole(role);
  // analyst sees dashboards ONLY — no PII. qa_auditor can see PII for scoring.
  return r !== "analyst";
}

/** Can view the delegate list */
export function canViewDelegates(role: string): boolean {
  return isAtLeast(role, "caller");
}

/** Can view and manage travel records */
export function canViewTravel(role: string): boolean {
  return isAtLeast(role, "caller");
}

/** Can use the concierge mailer */
export function canUseMailer(role: string): boolean {
  return isAtLeast(role, "regional_admin");
}

/** Can view team chat */
export function canViewChat(role: string): boolean {
  return isAtLeast(role, "caller");
}

/** Can view the audit / operation log */
export function canViewOperationLog(role: string): boolean {
  return isAtLeast(role, "regional_admin");
}

/** Can view/change app settings */
export function canViewSettings(role: string): boolean {
  return normalizeRole(role) === "master_admin";
}

/** Can allocate tasks (create batches, assign delegates) */
export function canAllocate(role: string): boolean {
  const r = normalizeRole(role);
  return ["master_admin", "regional_admin", "team_lead"].includes(r);
}

/** Can view allocation panel */
export function canViewAllocation(role: string): boolean {
  return isAtLeast(role, "caller");
}

/** Can manage workforce (shifts, attendance) */
export function canManageWorkforce(role: string): boolean {
  return isAtLeast(role, "regional_admin");
}

/** Can view workforce panel */
export function canViewWorkforce(role: string): boolean {
  return isAtLeast(role, "team_lead");
}

/** Can submit QA scores */
export function canSubmitQAScore(role: string): boolean {
  const r = normalizeRole(role);
  return r === "qa_auditor";
}

/** Can view QA panel (Exclusive for QA Auditor and Team Lead) */
export function canViewQA(role: string): boolean {
  const r = normalizeRole(role);
  return ["qa_auditor", "team_lead"].includes(r);
}


/** Can view BI reports + leaderboard */
export function canViewReports(role: string): boolean {
  return isAtLeast(role, "analyst");
}

/** Can view leaderboard */
export function canViewLeaderboard(role: string): boolean {
  return isAtLeast(role, "caller");
}

/** Can manage users (create/edit/deactivate) */
export function canManageUsers(role: string): boolean {
  return isAtLeast(role, "regional_admin");
}

/** Can manage any user (global scope) */
export function canManageAllUsers(role: string): boolean {
  return normalizeRole(role) === "master_admin";
}

/** Check if role is Compliance / Tech Auditor (read-only audit access) */
export function isComplianceRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "qa_auditor";
}

/** Can manage sector configuration & country pools */
export function canManageSectors(role: string): boolean {
  return normalizeRole(role) === "master_admin";
}

/** Can manage weekly roster allocations */
export function canManageRoster(role: string): boolean {
  return isAtLeast(role, "regional_admin");
}

/** Can manage email templates */
export function canManageEmailTemplates(role: string): boolean {
  return isAtLeast(role, "team_lead");
}


// ─── Role UI Metadata ─────────────────────────────────────────────────────────
export interface RoleMeta {
  label: string;
  shortLabel: string;
  description: string;
  color: string;       // CSS color for badge text
  bg: string;          // CSS background for badge
  borderColor: string;
}

export const ROLE_META: Record<V3Role, RoleMeta> = {
  master_admin: {
    label:       "Master Admin",
    shortLabel:  "M.Admin",
    description: "Global, unrestricted — infrastructure, security, role assignment",
    color:       "#7c3aed",
    bg:          "rgba(124,58,237,0.10)",
    borderColor: "rgba(124,58,237,0.25)",
  },
  regional_admin: {
    label:       "Regional Admin",
    shortLabel:  "R.Admin",
    description: "One or more continents — was Supervisor in v2",
    color:       "#0071e3",
    bg:          "rgba(0,113,227,0.10)",
    borderColor: "rgba(0,113,227,0.25)",
  },
  team_lead: {
    label:       "Team Lead",
    shortLabel:  "T.Lead",
    description: "One country — manages Callers, views QA scores",
    color:       "#0891b2",
    bg:          "rgba(8,145,178,0.10)",
    borderColor: "rgba(8,145,178,0.25)",
  },
  caller: {
    label:       "Caller",
    shortLabel:  "Caller",
    description: "Own assigned delegates only",
    color:       "#1d9a50",
    bg:          "rgba(29,154,80,0.10)",
    borderColor: "rgba(29,154,80,0.25)",
  },
  qa_auditor: {
    label:       "QA Auditor",
    shortLabel:  "QA",
    description: "Read-only + scoring rights on call logs — no allocation",
    color:       "#d97706",
    bg:          "rgba(217,119,6,0.10)",
    borderColor: "rgba(217,119,6,0.25)",
  },
  analyst: {
    label:       "Analyst",
    shortLabel:  "Analyst",
    description: "Leadership — dashboards only, zero PII",
    color:       "#6e6e73",
    bg:          "rgba(110,110,115,0.10)",
    borderColor: "rgba(110,110,115,0.25)",
  },
};

export function getRoleMeta(role: string): RoleMeta {
  return ROLE_META[normalizeRole(role)] ?? ROLE_META.caller;
}
