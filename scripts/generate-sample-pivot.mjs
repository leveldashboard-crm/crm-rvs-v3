/**
 * Generates sample-pivot-tables.xlsx
 * Run: node scripts/generate-sample-pivot.mjs
 *
 * Contains FOUR sheet tabs:
 *   1. "Dashboard Pivot"  ← ALL THREE pivot tables in ONE tab (recommended)
 *   2. "Country Pivot"    ← Country only (if you prefer separate tabs)
 *   3. "POC Pivot"        ← POC only
 *   4. "Region Pivot"     ← Region only
 */

import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "sample-pivot-tables.xlsx");

// ─── Raw data ──────────────────────────────────────────────────────────────────
const countries = [
  ["India", 87], ["China", 54], ["Bangladesh", 31], ["Sri Lanka", 18],
  ["Nepal", 12], ["UAE", 10], ["Vietnam", 8], ["Indonesia", 7],
  ["Pakistan", 6], ["Malaysia", 5], ["Kenya", 4], ["Nigeria", 3],
  ["Ghana", 2], ["Tanzania", 2], ["Ethiopia", 1],
];
const pocs = [
  ["Rahul", 95], ["Priya", 78], ["Amit", 45], ["Sunita", 32],
];
const regions = [
  ["South Asia", 148], ["Middle East", 30], ["Southeast Asia", 20],
  ["East Africa", 15], ["West Africa", 7], ["Other", 30],
];

// ─── Tab 1: All three pivot tables in ONE sheet ────────────────────────────────
// This is the RECOMMENDED setup.  In Settings, enter exactly:
//   Dashboard Pivot Table Sheet Tab = "Dashboard Pivot"
//
// HOW THE PARSER READS THIS SHEET:
//   • Row 1  → main header  → Column A contains "country"  → starts Country section
//   • "Grand Total" rows    → automatically skipped
//   • Blank rows            → automatically skipped
//   • "POC | Count of Sr No" row → Column B is non-numeric text → new section, A="poc"
//   • "Region | Count of Sr No"  → Column B is non-numeric text → new section, A="region"
//
// RULE: Every section separator row must have:
//   Column A = dimension keyword (country / poc / region / or anything → shows as extra card)
//   Column B = same header text as Row 1  e.g. "Count of Sr No"   ← must be non-numeric!

const combinedData = [
  // ── Country section ──
  ["Country Name",  "Count of Sr No"],   // ROW 1 — main header
  ...countries,
  ["Grand Total",   250],                // auto-skipped
  ["",              ""],                 // blank separator — auto-skipped

  // ── POC section ──
  // Column B = "Count of Sr No" (same text as header) → parser sees non-numeric → new section
  ["POC",           "Count of Sr No"],   // sub-header row
  ...pocs,
  ["Grand Total",   250],                // auto-skipped
  ["",              ""],                 // blank separator

  // ── Region section ──
  ["Region",        "Count of Sr No"],   // sub-header row
  ...regions,
  ["Grand Total",   250],                // auto-skipped
];

// ─── Tabs 2–4: One pivot per sheet (alternative approach) ─────────────────────
const countryOnly = [
  ["Country Name",  "Count of Sr No"],
  ...countries,
  ["Grand Total",   250],
];

const pocOnly = [
  ["POC",           "Count of Sr No"],
  ...pocs,
  ["Grand Total",   250],
];

const regionOnly = [
  ["Region",        "Count of Sr No"],
  ...regions,
  ["Grand Total",   250],
];

// ─── Build workbook ────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

function makeSheet(data) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 34 }, { wch: 18 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  return ws;
}

XLSX.utils.book_append_sheet(wb, makeSheet(combinedData), "Dashboard Pivot");
XLSX.utils.book_append_sheet(wb, makeSheet(countryOnly),  "Country Pivot");
XLSX.utils.book_append_sheet(wb, makeSheet(pocOnly),      "POC Pivot");
XLSX.utils.book_append_sheet(wb, makeSheet(regionOnly),   "Region Pivot");

XLSX.writeFile(wb, OUT);

console.log("✅  Written:", OUT);
console.log("");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("OPTION A — Single sheet for all three pivots (RECOMMENDED)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Sheet tab name  : Dashboard Pivot");
console.log("  Settings field  : Dashboard Pivot Table Sheet Tab = Dashboard Pivot");
console.log("  Result          : All 3 cards (Country / POC / Region) show LIVE badge");
console.log("");
console.log("OPTION B — Separate sheet per pivot");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Sheet tab name  : Country Pivot  →  Settings = Country Pivot");
console.log("  Sheet tab name  : POC Pivot      →  Settings = POC Pivot");
console.log("  Sheet tab name  : Region Pivot   →  Settings = Region Pivot");
console.log("  (Each setting replaces only that one card; others stay computed)");
console.log("");
console.log("IMPORT STEPS:");
console.log("  1. Open your Google Sheet (the registration spreadsheet)");
console.log("  2. Click  +  (add sheet) at the bottom → name it 'Dashboard Pivot'");
console.log("  3. Paste the data from the 'Dashboard Pivot' tab of this file");
console.log("  4. OPTIONAL: replace sample numbers with a real Pivot Table");
console.log("     (Insert → Pivot table → source = Form Responses 1)");
console.log("     Then rename col A header from 'Row Labels' to 'Country Name' / 'POC' / 'Region'");
console.log("  5. In the app: Settings → Dashboard Pivot Table Sheet Tab = Dashboard Pivot → Save");
