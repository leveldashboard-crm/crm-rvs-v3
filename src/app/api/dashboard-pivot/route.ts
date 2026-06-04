import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export type PivotType = "country" | "poc" | "region" | "generic";

export interface PivotRow {
  label: string;
  count: number;
}

export interface DashboardPivotResponse {
  ok: boolean;
  configured: boolean;
  /** Rows auto-assigned to Country-wise card (empty if not found in sheet) */
  countryRows: PivotRow[];
  /** Rows auto-assigned to POC-wise card */
  pocRows: PivotRow[];
  /** Rows auto-assigned to Region-wise card */
  regionRows: PivotRow[];
  /** Rows from any section whose header didn't match a known dimension */
  genericRows: PivotRow[];
  sheetName?: string;
  error?: string;
}

// ─── GET /api/dashboard-pivot ─────────────────────────────────────────────────
// Reads the configured sheet tab via GAS getRows and splits it into up to four
// named pivot sections. A single sheet tab can contain Country, POC, and Region
// pivot tables stacked vertically — the parser detects each section boundary.
export async function GET(): Promise<NextResponse<DashboardPivotResponse>> {
  const empty: DashboardPivotResponse = {
    ok: false, configured: false,
    countryRows: [], pocRows: [], regionRows: [], genericRows: [],
  };

  const session = await auth();
  if (!session) return NextResponse.json({ ...empty, error: "Unauthorized" }, { status: 401 });

  try {
    try {
      await db.execute(
        sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS dashboard_pivot_sheet_name TEXT`
      );
    } catch { /* already exists */ }

    const result = await db.execute(sql`
      SELECT gas_web_app_url, registration_sheet_id, dashboard_pivot_sheet_name
      FROM app_settings WHERE id = 1 LIMIT 1
    `);
    const settings = Array.from(result)[0] as Record<string, string | null> | undefined;

    const gasUrl         = settings?.gas_web_app_url ?? "";
    const sheetId        = settings?.registration_sheet_id ?? "";
    const pivotSheetName = settings?.dashboard_pivot_sheet_name ?? "";

    if (!gasUrl || !sheetId || !pivotSheetName) {
      return NextResponse.json({ ...empty, configured: false });
    }

    const url = new URL(gasUrl);
    url.searchParams.set("action",    "getRows");
    url.searchParams.set("sheetId",   sheetId);
    url.searchParams.set("sheetName", pivotSheetName);

    const gasRes = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!gasRes.ok) throw new Error(`GAS responded with HTTP ${gasRes.status}`);

    const gasData = await gasRes.json() as {
      ok: boolean;
      rows?: Record<string, unknown>[];
      error?: string;
    };

    if (!gasData.ok) throw new Error(gasData.error ?? "GAS returned ok:false");

    const sections = parsePivotSheet(gasData.rows ?? []);

    const countryRows = sections.find(s => s.type === "country")?.rows ?? [];
    const pocRows     = sections.find(s => s.type === "poc")?.rows     ?? [];
    const regionRows  = sections.find(s => s.type === "region")?.rows  ?? [];
    const genericRows = sections.filter(s => s.type === "generic").flatMap(s => s.rows);

    return NextResponse.json({
      ok: true,
      configured: true,
      countryRows,
      pocRows,
      regionRows,
      genericRows,
      sheetName: pivotSheetName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/dashboard-pivot]", message);
    return NextResponse.json({ ...empty, configured: true, error: message });
  }
}

// ─── Multi-section pivot parser ────────────────────────────────────────────────
// Handles BOTH a single pivot table AND multiple pivot tables stacked in one sheet.
//
// Single-pivot sheet (one dimension):
//   Row 1:  Country Name  | Count of Sr No   ← main header
//   Row 2+: India         | 87
//   Last:   Grand Total   | 250              ← skipped
//
// Multi-pivot sheet (all three in one tab):
//   Row 1:  Country Name  | Count of Sr No   ← main header (first section)
//   ...     India         | 87
//           Grand Total   | 250              ← skipped
//           <blank row>                      ← skipped
//   Row X:  POC           | Count of Sr No   ← sub-header (B is non-numeric → new section)
//   ...     Rahul         | 95
//           Grand Total   | 250              ← skipped
//           <blank row>                      ← skipped
//   Row Y:  Region        | Count of Sr No   ← sub-header → new section
//   ...     South Asia    | 148
//           Grand Total   | 250              ← skipped

interface Section { type: PivotType; rows: PivotRow[] }

const SKIP_LABELS = new Set([
  "grand total", "total", "row labels", "(blank)", "subtotal",
]);

function detectType(label: string): PivotType {
  const lh = label.toLowerCase().replace(/[\s_\-()\/.]+/g, "");
  if (lh.includes("country"))               return "country";
  if (lh === "poc" || lh.includes("poc"))   return "poc";
  if (lh.includes("region"))               return "region";
  return "generic";
}

function parsePivotSheet(rawRows: Record<string, unknown>[]): Section[] {
  if (rawRows.length === 0) return [];

  const headers  = Object.keys(rawRows[0]).filter(k => k.trim());
  if (headers.length < 2) return [];

  const labelKey = headers[0];

  // The count column is the first column (after labelKey) that has at least one numeric value
  const countKey = headers.slice(1).find(k =>
    rawRows.some(r => r[k] != null && r[k] !== "" && isFinite(Number(r[k])))
  ) ?? headers[1];

  const sections: Section[] = [];
  let currentType = detectType(labelKey); // derived from main header (row 1)
  let currentRows: PivotRow[] = [];

  const flush = () => {
    if (currentRows.length > 0) {
      sections.push({
        type: currentType,
        rows: [...currentRows].sort((a, b) => b.count - a.count),
      });
      currentRows = [];
    }
  };

  for (const row of rawRows) {
    const label    = String(row[labelKey] ?? "").trim();
    const countRaw = row[countKey];
    const countStr = String(countRaw ?? "").trim();

    // Skip fully blank rows
    if (!label && !countStr) continue;

    // A sub-header row: column B is non-numeric text (e.g. "Count of Sr No", "Count")
    // This marks the start of a new pivot section in the same sheet.
    if (label && countStr && isNaN(Number(countStr))) {
      flush();
      currentType = detectType(label);
      continue;
    }

    // Skip summary / label rows
    if (!label || SKIP_LABELS.has(label.toLowerCase())) continue;

    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!isFinite(count) || count <= 0) continue;

    currentRows.push({ label, count });
  }

  flush();
  return sections;
}
