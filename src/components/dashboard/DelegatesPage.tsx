"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Search, Users, Globe, RefreshCw, Building2, X, Check, ShieldAlert, Landmark, Building } from "lucide-react";
import { detectSectorType, type RegistrationRow } from "@/lib/crm-utils";
import { normalizeRole, canViewSettings } from "@/lib/rbac";
import { TEMPERATURE_META } from "@/lib/lead-scoring";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const EXCLUDED = ["sri lanka", "nepal", "bangladesh"];

interface Props {
  role: string;
}

export default function DelegatesPage({ role }: Props) {
  const { data, isLoading, mutate } = useSWR<{ rows: RegistrationRow[]; total: number }>(
    "/api/registrations?limit=5000",
    fetcher,
    { revalidateOnFocus: false }
  );

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);

  const [search, setSearch]                   = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch]       = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [sector, setSector]                   = useState("");
  const [sectorTypeFilter, setSectorTypeFilter] = useState<"all" | "government" | "private">("all");
  const [showExcl, setShowExcl]               = useState(true);

  const isAdmin = canViewSettings(normalizeRole(role));

  // Unique filter options
  const countries = useMemo(() =>
    [...new Set(rows.map(r => r.country_name ?? r.passport_country ?? "").filter(Boolean))].sort()
  , [rows]);

  const searchedCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(c => c.toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const sectors = useMemo(() =>
    [...new Set(rows.map(r => r.main_import_product_1 ?? "").filter(Boolean))].sort()
  , [rows]);

  // Counts for Government vs Private
  const govtCount = useMemo(() => rows.filter(r => detectSectorType(r) === "government").length, [rows]);
  const privateCount = useMemo(() => rows.filter(r => detectSectorType(r) === "private").length, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (!showExcl) list = list.filter(r => !EXCLUDED.includes((r.country_name ?? r.passport_country ?? "").toLowerCase()));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        [r.first_name, r.last_name, r.company_name, r.country_name, r.passport_country, r.participant_email]
          .some(v => (v ?? "").toLowerCase().includes(q))
      );
    }
    if (selectedCountries.length > 0) {
      list = list.filter(r => selectedCountries.includes(r.country_name ?? r.passport_country ?? ""));
    }
    if (sector) {
      list = list.filter(r => r.main_import_product_1 === sector);
    }
    if (sectorTypeFilter !== "all") {
      list = list.filter(r => detectSectorType(r) === sectorTypeFilter);
    }
    return list;
  }, [rows, search, selectedCountries, sector, sectorTypeFilter, showExcl]);

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center shadow-lg text-white">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Registered Delegates
            </h1>
            <p className="text-[0.9rem] text-[var(--color-text-secondary)] mt-0.5 font-medium">
              {isLoading ? "Loading…" : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} delegates`}
            </p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => mutate()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Stats Strip (with Govt vs Private Bifurcation) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Delegates", value: rows.length, color: "var(--color-accent)", icon: <Users size={16} /> },
          { label: "🏛️ Government Sector", value: govtCount, color: "#5856d6", icon: <Landmark size={16} /> },
          { label: "🏢 Private Sector", value: privateCount, color: "#10b981", icon: <Building size={16} /> },
          { label: "Active Countries", value: countries.length, color: "#f59e0b", icon: <Globe size={16} /> },
          {
            label: "Excl. SL/NP/BD",
            value: rows.filter(r => !EXCLUDED.includes((r.country_name ?? r.passport_country ?? "").toLowerCase())).length,
            color: "#8b5cf6",
            icon: <ShieldAlert size={16} />
          },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold flex items-center gap-1.5" style={{ color: s.color }}>
              {s.value.toLocaleString()}
            </div>
            <div className="text-[0.7rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wide mt-1 flex items-center gap-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters & Search ── */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              id="delegates-search"
              type="search"
              className="input w-full pl-9 py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[0.85rem]"
              placeholder="Search delegate name, company, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Government vs Private Sector Bifurcation Filter */}
          <div className="flex items-center bg-[var(--color-bg-primary)] p-1 rounded-lg border border-[var(--color-border)] text-xs font-semibold">
            <button
              onClick={() => setSectorTypeFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${sectorTypeFilter === "all" ? "bg-[var(--color-surface)] shadow-2xs font-bold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}
            >
              All Types
            </button>
            <button
              onClick={() => setSectorTypeFilter("government")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${sectorTypeFilter === "government" ? "bg-[#5856d6]/20 text-[#5856d6] font-bold shadow-2xs" : "text-[var(--color-text-secondary)]"}`}
            >
              <Landmark size={12} /> Govt Sector
            </button>
            <button
              onClick={() => setSectorTypeFilter("private")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${sectorTypeFilter === "private" ? "bg-emerald-500/20 text-emerald-700 font-bold shadow-2xs" : "text-[var(--color-text-secondary)]"}`}
            >
              <Building size={12} /> Private Sector
            </button>
          </div>

          {/* Multi-Country Picker Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 bg-[var(--color-bg-primary)]"
            >
              <Globe size={13} />
              {selectedCountries.length === 0 ? "Select Countries (All)" : `${selectedCountries.length} Countries Selected`}
            </button>

            {/* Multi-Country Search Dropdown */}
            {showCountryPicker && (
              <div className="absolute right-0 top-11 z-50 w-72 glass-card bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] shadow-xl flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold border-b border-[var(--color-border)] pb-2">
                  <span>Multi-Country Search &amp; Add</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCountries(countries)}
                      className="text-[10px] text-[var(--color-accent)] font-semibold hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedCountries([])}
                      className="text-[10px] text-[var(--color-danger)] font-semibold hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <input
                    type="search"
                    placeholder="Search country name..."
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    className="input w-full pl-8 py-1 text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-1 custom-scrollbar pr-1">
                  {searchedCountries.map(c => {
                    const isSelected = selectedCountries.includes(c);
                    return (
                      <label key={c} className="flex items-center justify-between text-xs p-1.5 rounded-md hover:bg-[var(--color-bg-primary)] cursor-pointer select-none">
                        <span className="font-medium text-[var(--color-text-primary)]">{c}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCountry(c)}
                          className="w-3.5 h-3.5 accent-[var(--color-accent)]"
                        />
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowCountryPicker(false)}
                  className="btn-primary w-full py-1 text-xs mt-1"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Sector filter */}
          <select
            id="delegates-sector"
            className="input py-2 min-w-[160px] bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[0.85rem]"
            value={sector}
            onChange={e => setSector(e.target.value)}
          >
            <option value="">All Industry Sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Excl toggle */}
          <label className="flex items-center gap-2 text-[0.82rem] font-medium text-[var(--color-text-secondary)] cursor-pointer select-none whitespace-nowrap">
            <input
              id="delegates-excl-toggle"
              type="checkbox"
              className="w-4 h-4 accent-[var(--color-accent)]"
              checked={showExcl}
              onChange={e => setShowExcl(e.target.checked)}
            />
            Include SL / NP / BD
          </label>

          {/* Clear */}
          {(search || selectedCountries.length > 0 || sector || sectorTypeFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setSelectedCountries([]); setSector(""); setSectorTypeFilter("all"); }}
              className="flex items-center gap-1 px-3 py-2 text-[0.8rem] font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Selected Country Badges */}
        {selectedCountries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-border)]">
            <span className="text-[11px] font-bold text-[var(--color-text-secondary)] mr-1">Active Country Filters:</span>
            {selectedCountries.map(c => (
              <span key={c} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 px-2 py-0.5 rounded-full">
                {c}
                <X size={10} className="cursor-pointer hover:opacity-75" onClick={() => toggleCountry(c)} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar">
          <table className="data-table w-full text-[0.8rem]">
            <thead>
              <tr>
                <th className="text-center w-10">Sr</th>
                <th>Name</th>
                <th>Company</th>
                <th>Sector Bifurcation</th>
                <th><Globe size={12} className="inline mr-1" />Country</th>
                <th>Region</th>
                <th><Building2 size={12} className="inline mr-1" />Industry Sector</th>
                <th>POC</th>
                <th className="text-center">Flight &amp; Hotel</th>
                <th className="text-center">Lead Temp</th>
                {isAdmin && <th className="text-center">Status</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="text-center py-12 text-[var(--color-text-tertiary)]">
                    <RefreshCw size={18} className="inline animate-spin mr-2" />Loading delegates…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="text-center py-12 text-[var(--color-text-tertiary)]">
                    No delegates match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const name = [r.title, r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
                const country = r.country_name ?? r.passport_country ?? "—";
                const fh = (r.flight_hotel_code ?? "").trim();
                const sectorType = detectSectorType(r);
                const isGovt = sectorType === "government";
                return (
                  <tr key={r.id} className={i % 2 === 0 ? "" : "bg-[var(--color-bg-primary)]/40"}>
                    <td className="text-center font-mono text-xs text-[var(--color-text-tertiary)]">
                      {r.sr_no ?? i + 1}
                    </td>
                    <td>
                      <div className="font-semibold text-[var(--color-text-primary)] truncate max-w-[160px]" title={name}>
                        {name}
                      </div>
                    </td>
                    <td className="max-w-[150px] truncate font-medium" title={r.company_name ?? ""}>
                      {r.company_name ?? "—"}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isGovt ? "bg-[#5856d6]/15 text-[#5856d6] border border-[#5856d6]/30" : "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"}`}>
                        {isGovt ? <Landmark size={10} /> : <Building size={10} />}
                        {isGovt ? "Government" : "Private"}
                      </span>
                    </td>
                    <td className="font-medium">{country}</td>
                    <td className="text-[var(--color-text-secondary)]">{r.region ?? "—"}</td>
                    <td>
                      {r.main_import_product_1 ? (
                        <span className="badge badge-neutral text-[0.7rem]">{r.main_import_product_1}</span>
                      ) : "—"}
                    </td>
                    <td className="font-medium">{r.poc ?? "—"}</td>
                    <td className="text-center">
                      {fh ? (
                        <span className="badge badge-success text-[0.7rem] px-2">{fh}</span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {(() => {
                        const temp = (r as { lead_temperature?: string | null }).lead_temperature;
                        if (!temp) return <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.7rem" }}>—</span>;
                        const meta = TEMPERATURE_META[temp as keyof typeof TEMPERATURE_META];
                        if (!meta) return <span style={{ fontSize: "0.7rem" }}>{temp}</span>;
                        return (
                          <span style={{
                            background: meta.bg, color: meta.color,
                            padding: "2px 7px", borderRadius: 10,
                            fontSize: "0.65rem", fontWeight: 700,
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}>
                            {meta.emoji} {temp}
                          </span>
                        );
                      })()}
                    </td>
                    {isAdmin && (
                      <td className="text-center">
                        {r.status ? (
                          <span className={`badge text-[0.7rem] px-2 ${
                            (r.status ?? "").toLowerCase().includes("confirm") ? "badge-success" :
                            (r.status ?? "").toLowerCase().includes("cancel") ? "badge-danger" :
                            "badge-neutral"
                          }`}>{r.status}</span>
                        ) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-[0.75rem] text-[var(--color-text-tertiary)] flex justify-between items-center">
          <span>Showing {filtered.length.toLocaleString()} delegate{filtered.length !== 1 ? "s" : ""}</span>
          <span>🏛️ {govtCount} Government · 🏢 {privateCount} Private</span>
        </div>
      </div>
    </div>
  );
}
