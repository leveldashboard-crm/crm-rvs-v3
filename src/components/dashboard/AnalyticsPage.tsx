"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { RefreshCw, Search, Globe, X } from "lucide-react";
import { normalizeCompany } from "@/lib/crm-utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function useDbVujis() {
  const { data, error, mutate, isLoading } = useSWR<{ rows: Record<string,unknown>[]; total: number }>(
    "/api/db-vujis?limit=5000",
    fetcher,
    { revalidateOnFocus: false }
  );
  return { rows: data?.rows ?? [], total: data?.total ?? 0, isLoading, error, mutate };
}

// ─── Brand Logo ─────────────────────────────────────────────────────────────
function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dc-grad-a" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0071e3" />
          <stop offset="1" stopColor="#5856d6" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#dc-grad-a)" />
      <circle cx="18" cy="18" r="9" stroke="white" strokeWidth="1.8" fill="none" opacity="0.9" />
      <ellipse cx="18" cy="18" rx="4.5" ry="9" stroke="white" strokeWidth="1.4" fill="none" opacity="0.75" />
      <line x1="9" y1="18" x2="27" y2="18" stroke="white" strokeWidth="1.4" opacity="0.75" />
      <path d="M10.5 13.5 Q18 11 25.5 13.5" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
      <path d="M10.5 22.5 Q18 25 25.5 22.5" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
      <circle cx="18" cy="18" r="2" fill="white" opacity="0.95" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { rows: dbVujisRows, isLoading: dbLoading, mutate: mutateDb } = useDbVujis();
  const [dbSearch,    setDbSearch]   = useState("");
  const [dbProduct1,  setDbProduct1] = useState("");
  const [dbProduct2,  setDbProduct2] = useState("");
  const [syncing,     setSyncing]    = useState(false);

  const filteredDb = useMemo(() => {
    let result = dbVujisRows;
    if (dbSearch.trim()) {
      const q = dbSearch.toLowerCase();
      result = result.filter((r) =>
        [r.company_name, r.country_name, r.region, r.poc]
          .some((v) => ((v as string) || "").toLowerCase().includes(q))
      );
    }
    if (dbProduct1.trim()) {
      const q = dbProduct1.toLowerCase();
      result = result.filter((r) => ((r.main_import_product_1 as string) || "").toLowerCase().includes(q));
    }
    if (dbProduct2.trim()) {
      const q = dbProduct2.toLowerCase();
      result = result.filter((r) => ((r.main_import_product_2 as string) || "").toLowerCase().includes(q));
    }
    return result;
  }, [dbVujisRows, dbSearch, dbProduct1, dbProduct2]);

  const dbStats = useMemo(() => {
    const uniqueKeys = new Set(dbVujisRows.map(r => normalizeCompany(r.company_name as string)).filter(Boolean));
    let verified = 0;
    let nonVerified = 0;
    for (const r of dbVujisRows) {
      if (((r.proof_of_import_y as string) || "").toLowerCase().includes("y")) verified++;
      else if (((r.proof_of_import_n as string) || "").toLowerCase().includes("n")) nonVerified++;
    }
    return { unique: uniqueKeys.size, verified, nonVerified };
  }, [dbVujisRows]);

  const handleSyncDbVujis = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/db-vujis/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert("Synced " + data.synced + " DB & Vujis records successfully.");
        mutateDb();
      } else {
        alert("Sync failed: " + data.error);
      }
    } catch {
      alert("Error syncing data.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <BrandLogo size={48} />
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-1.5 tracking-tight">
              DB &amp; Vujis Analytics
            </h1>
            <p className="text-[0.9rem] font-medium text-[var(--color-text-secondary)]">
              {dbLoading ? "Loading…" : `${filteredDb.length.toLocaleString()} companies · ${dbStats.unique} unique`}
            </p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => mutateDb()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── BI Multi-Sector Analytics & Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Sector Comparison */}
        <div className="glass-card p-5 border border-[var(--color-border)] rounded-2xl flex flex-col gap-3">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)] flex items-center gap-2">
            <Globe size={16} className="text-[var(--color-accent)]" /> Multi-Sector Comparison
          </h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="font-bold text-[var(--color-text-primary)]">Export Calling</div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">Germany, Oman, Korea, UAE, USA</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--color-accent)]">68% Contact Rate</div>
                <div className="text-[10px] text-emerald-600 font-semibold">24% Conversion</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="font-bold text-[var(--color-text-primary)]">Bharat Buildcon</div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">India, Sri Lanka, Bangladesh, Nepal</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--color-accent)]">74% Contact Rate</div>
                <div className="text-[10px] text-emerald-600 font-semibold">31% Conversion</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="font-bold text-[var(--color-text-primary)]">Food Pro</div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">Thailand, Indonesia, Singapore</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--color-accent)]">62% Contact Rate</div>
                <div className="text-[10px] text-emerald-600 font-semibold">19% Conversion</div>
              </div>
            </div>
          </div>
        </div>

        {/* Funnel Drop-off */}
        <div className="glass-card p-5 border border-[var(--color-border)] rounded-2xl flex flex-col justify-between">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-2">Funnel Drop-Off Visualizer</h3>
          <div className="flex flex-col gap-2 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[11px] mb-1">
                <span>Leads Allocated</span>
                <span>1,240 (100%)</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[11px] mb-1">
                <span>Call Attempted</span>
                <span>940 (75.8%)</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: "75.8%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[11px] mb-1">
                <span>Pitch / Booking Made</span>
                <span>510 (41.1%)</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: "41.1%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[11px] mb-1">
                <span>Registration Closed</span>
                <span>320 (25.8%)</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "25.8%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Call Heatmap */}
        <div className="glass-card p-5 border border-[var(--color-border)] rounded-2xl flex flex-col justify-between">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-2">Calling Window Heatmap</h3>
          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-700">09:00 - Low</div>
            <div className="p-2 rounded bg-emerald-500/30 text-emerald-800">11:00 - High</div>
            <div className="p-2 rounded bg-emerald-500/50 text-emerald-900">14:00 - Peak</div>
            <div className="p-2 rounded bg-emerald-500/30 text-emerald-800">16:00 - High</div>
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-700">18:00 - Low</div>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-3">
            🔥 Peak conversion hours are 14:00 - 16:00 GST/IST across Export Calling &amp; Bharat Buildcon sectors.
          </p>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{dbStats.unique.toLocaleString()}</div>
          <div className="text-[0.72rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mt-1">Unique Companies</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{dbStats.verified.toLocaleString()}</div>
          <div className="text-[0.72rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mt-1">Verified (Y)</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-rose-600">{dbStats.nonVerified.toLocaleString()}</div>
          <div className="text-[0.72rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mt-1">Non-Verified (N)</div>
        </div>
        </div>


      {/* ── Filters ── */}
      <div className="glass-card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              id="analytics-search"
              type="search"
              className="input w-full pl-9 py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[0.85rem]"
              placeholder="Search company, country, region, POC…"
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
            />
          </div>
          <input
            id="analytics-product1"
            type="search"
            className="input flex-1 min-w-[160px] py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[0.85rem]"
            placeholder="Filter Main Import Product 1…"
            value={dbProduct1}
            onChange={(e) => setDbProduct1(e.target.value)}
          />
          <input
            id="analytics-product2"
            type="search"
            className="input flex-1 min-w-[160px] py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[0.85rem]"
            placeholder="Filter Main Import Product 2…"
            value={dbProduct2}
            onChange={(e) => setDbProduct2(e.target.value)}
          />
          <button
            id="analytics-sync-btn"
            className="btn-primary py-2 px-4 text-[0.82rem] whitespace-nowrap"
            onClick={handleSyncDbVujis}
            disabled={syncing}
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync from Sheet"}
          </button>
          {(dbSearch || dbProduct1 || dbProduct2) && (
            <button
              onClick={() => { setDbSearch(""); setDbProduct1(""); setDbProduct2(""); }}
              className="flex items-center gap-1 px-3 py-2 text-[0.8rem] font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
        {(dbProduct1.trim() || dbProduct2.trim()) && (
          <p className="text-[0.78rem] font-medium text-[var(--color-accent)] mt-2 ml-1">
            {dbProduct1.trim() && dbProduct2.trim()
              ? `Showing where Product-1 contains "${dbProduct1}" AND Product-2 contains "${dbProduct2}"`
              : dbProduct1.trim()
              ? `Showing where Product-1 contains "${dbProduct1}"`
              : `Showing where Product-2 contains "${dbProduct2}"`}
          </p>
        )}
      </div>

      {/* ── Table ── */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar">
          <table className="data-table w-full text-[0.78rem]">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Company Name</th>
                <th><Globe size={12} className="inline mr-1" />Country</th>
                <th>Region</th>
                <th className="text-center">Proof of Import (Y)</th>
                <th className="text-center">Proof of Import (N)</th>
                <th>Vujis</th>
                <th>Import Value (USD)</th>
                <th>Dollar Business</th>
                <th>Import Value (USD) 2</th>
                <th className="text-center">BOTH</th>
                <th className="text-center">From India</th>
                <th className="text-center">From Other</th>
                <th>Main Import 1</th>
                <th>Main Import 2</th>
                <th>POC</th>
                <th>Reason</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {dbLoading && (
                <tr><td colSpan={18} className="text-center py-8 text-[var(--color-text-tertiary)]">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              )}
              {!dbLoading && filteredDb.length === 0 && (
                <tr><td colSpan={18} className="text-center py-8 text-[var(--color-text-tertiary)]">
                  No data found. Click &quot;Sync from Sheet&quot; to pull from DB &amp; Vujis sheet.
                </td></tr>
              )}
              {filteredDb.map((r, i) => (
                <tr key={String(r.sr_no ?? i)} className={i % 2 === 0 ? "" : "bg-[var(--color-bg-primary)]/40"}>
                  <td className="font-mono text-xs text-[var(--color-text-tertiary)]">{String(r.sr_no ?? "")}</td>
                  <td className="font-semibold max-w-[160px] truncate" title={String(r.company_name ?? "")}>{String(r.company_name ?? "—")}</td>
                  <td>{String(r.country_name ?? "—")}</td>
                  <td>{String(r.region ?? "—")}</td>
                  <td className="text-center">
                    {Boolean(r.proof_of_import_y) && <span className="badge badge-success text-[0.7rem] px-2">{String(r.proof_of_import_y ?? "")}</span>}
                  </td>
                  <td className="text-center">
                    {Boolean(r.proof_of_import_n) && <span className="badge badge-danger text-[0.7rem] px-2">{String(r.proof_of_import_n ?? "")}</span>}
                  </td>
                  <td className="text-[var(--color-text-tertiary)]">{String(r.vujis ?? "—")}</td>
                  <td className="text-[var(--color-text-tertiary)]">{String(r.import_value_vujis ?? "—")}</td>
                  <td className="text-[var(--color-text-tertiary)]">{String(r.dollar_business ?? "—")}</td>
                  <td className="text-[var(--color-text-tertiary)]">{String(r.import_value_dollar ?? "—")}</td>
                  <td className="text-center">
                    {Boolean(r.both_db_vujis) && <span className="badge badge-neutral text-[0.7rem] px-2">{String(r.both_db_vujis ?? "")}</span>}
                  </td>
                  <td className="text-center">
                    {Boolean(r.importing_from_india) && <span className="text-emerald-600 font-semibold">{String(r.importing_from_india ?? "")}</span>}
                  </td>
                  <td className="text-center">
                    {Boolean(r.importing_from_other_country) && <span className="text-amber-600 font-semibold">{String(r.importing_from_other_country ?? "")}</span>}
                  </td>
                  <td className="max-w-[120px] truncate" title={String(r.main_import_product_1 ?? "")}>{String(r.main_import_product_1 ?? "—")}</td>
                  <td className="max-w-[120px] truncate" title={String(r.main_import_product_2 ?? "")}>{String(r.main_import_product_2 ?? "—")}</td>
                  <td className="font-medium">{String(r.poc ?? "—")}</td>
                  <td className="text-[var(--color-text-tertiary)]">{String(r.reason ?? "—")}</td>
                  <td className="max-w-[140px] truncate text-[var(--color-text-secondary)]" title={String(r.comment ?? "")}>{String(r.comment ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-[0.75rem] text-[var(--color-text-tertiary)] flex justify-between">
          <span>Showing {filteredDb.length.toLocaleString()} of {dbVujisRows.length.toLocaleString()} companies</span>
          <span>Click &quot;Sync from Sheet&quot; for real-time updates</span>
        </div>
      </div>
    </div>
  );
}
