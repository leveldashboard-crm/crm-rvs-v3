"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Search, Mail, CheckCircle, Clock, RefreshCw,
  Filter, Upload, FileSpreadsheet, X, ChevronDown,
  ChevronRight, Globe, Tag, AlertCircle, Calendar, CalendarDays
} from "lucide-react";
import { normalizeRole } from "@/lib/rbac";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LeadRow {
  id: number;
  sr_no: number;
  first_name: string;
  last_name: string;
  country_name: string;
  company_name: string;
  main_import_product_1: string;
  main_import_product_2?: string;
  poc: string;
  assigned_caller_id: number | null;
  caller_comment: string | null;
  caller_remark: string | null;
  email_request_status: "none" | "pending" | "sent" | null;
  follow_up_date?: string | null;
  status?: string;
  participant_mobile?: string;
  participant_email?: string;
  designation?: string;
  company_website?: string;
}


// ─── Excel Import Types ────────────────────────────────────────────────────────
interface ParsedImportRow {
  srNo?: number | null;
  firstName?: string;
  lastName?: string;
  countryName?: string;
  companyName?: string;
  mainImportProduct1?: string;
  mainImportProduct2?: string;
  poc?: string;
  participantMobile?: string;
  participantEmail?: string;
  designation?: string;
  status?: string;
  [key: string]: unknown;
}

interface CountryGroup {
  country: string;
  rows: ParsedImportRow[];
  sectors: Set<string>;
}

// Normalize a CSV header key
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

// Map normalized key to a known field
function mapField(normKey: string): string | null {
  if (normKey.includes("sr") && (normKey.includes("no") || normKey === "sr")) return "srNo";
  if (normKey.includes("first") && normKey.includes("name")) return "firstName";
  if (normKey.includes("last") && normKey.includes("name")) return "lastName";
  if ((normKey.includes("country")) && normKey.includes("name")) return "countryName";
  if (normKey === "country") return "countryName";
  if (normKey.includes("company") && normKey.includes("name")) return "companyName";
  if (normKey.includes("company")) return "companyName";
  if (normKey.includes("import") && normKey.includes("product") && normKey.includes("2")) return "mainImportProduct2";
  if (normKey.includes("import") && normKey.includes("product")) return "mainImportProduct1";
  if (normKey.includes("sector") && normKey.includes("2")) return "mainImportProduct2";
  if (normKey.includes("sector") && normKey.includes("1")) return "mainImportProduct1";
  if (normKey === "sector") return "mainImportProduct1";
  if (normKey === "poc") return "poc";
  if (normKey.includes("mobile") || normKey.includes("whatsapp") || normKey.includes("phone")) return "participantMobile";
  if (normKey.includes("email")) return "participantEmail";
  if (normKey.includes("designation")) return "designation";
  if (normKey === "status") return "status";
  return null;
}

// Parse a CSV string into rows
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Split handling quoted fields
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { result.push(cur); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur);
    return result.map((v) => v.trim().replace(/^"|"$/g, ""));
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

// Map raw CSV row to ParsedImportRow
function mapRawRow(raw: Record<string, string>): ParsedImportRow {
  const mapped: ParsedImportRow = {};
  for (const [rawKey, val] of Object.entries(raw)) {
    const normKey = normalizeKey(rawKey);
    const field = mapField(normKey);
    if (field) {
      if (field === "srNo") {
        const n = Number(val);
        mapped.srNo = isNaN(n) ? null : n;
      } else {
        (mapped as any)[field] = val?.trim() || undefined;
      }
    }
  }
  return mapped;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExcelLeadsSheet() {
  const { data: sessionData } = useSWR("/api/auth/session", fetcher);

  const currentUser = sessionData?.user as
    | { id?: string; name?: string; role?: string }
    | undefined;
  const role = normalizeRole(currentUser?.role);
  const userId = currentUser?.id ? parseInt(currentUser.id) : null;
  const isCaller = role === "caller";
  const isAdmin = role === "master_admin" || role === "regional_admin" || role === "team_lead";

  // Build the API URL: callers pass their own POC name so the server filters it
  const pocName = isCaller ? encodeURIComponent(currentUser?.name ?? "") : "";
  const apiUrl = isCaller && pocName
    ? `/api/registrations?limit=5000&poc=${pocName}`
    : "/api/registrations?limit=5000";

  const { data: regsData, mutate, isLoading } = useSWR<{ rows: LeadRow[]; total: number }>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // ─── State ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterPendingEmails, setFilterPendingEmails] = useState(false);
  const [filterFollowUp, setFilterFollowUp] = useState<"all" | "today" | "overdue" | "scheduled" | "set">("all");
  const [selectedCallerFilter, setSelectedCallerFilter] = useState<string>("all");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("all");
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ─── Import State ─────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => regsData?.rows ?? [], [regsData?.rows]);

  // ─── Derive unique countries + sectors from rows ──────────────────────────
  const countries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.country_name) set.add(r.country_name); });
    return Array.from(set).sort();
  }, [rows]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.main_import_product_1) set.add(r.main_import_product_1); });
    return Array.from(set).sort();
  }, [rows]);

  // ─── Filter rows ──────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = rows;

    // Admin-only filters (callers see server-filtered results already)
    if (!isCaller) {
      if (selectedCallerFilter !== "all") {
        list = list.filter((r) => String(r.assigned_caller_id) === selectedCallerFilter);
      }
      if (selectedCountryFilter !== "all") {
        list = list.filter((r) => r.country_name === selectedCountryFilter);
      }
      if (selectedSectorFilter !== "all") {
        list = list.filter((r) => r.main_import_product_1 === selectedSectorFilter);
      }
    }

    if (filterPendingEmails) {
      list = list.filter((r) => r.email_request_status === "pending");
    }

    if (filterFollowUp !== "all") {
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter((r) => {
        if (!r.follow_up_date) return false;
        const dateStr = new Date(r.follow_up_date).toISOString().slice(0, 10);
        if (filterFollowUp === "today") return dateStr === todayStr;
        if (filterFollowUp === "overdue") return dateStr < todayStr;
        if (filterFollowUp === "scheduled") return dateStr > todayStr;
        if (filterFollowUp === "set") return !!r.follow_up_date;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        [r.first_name, r.last_name, r.company_name, r.country_name, r.main_import_product_1, r.poc]
          .some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }

    return list;
  }, [rows, isCaller, selectedCallerFilter, selectedCountryFilter, selectedSectorFilter, filterPendingEmails, filterFollowUp, search]);

  // ─── Update handler ───────────────────────────────────────────────────────
  const handleUpdate = async (
    regId: number,
    payload: {
      callerComment?: string | null;
      callerRemark?: string | null;
      emailRequestStatus?: string | null;
      followUpDate?: string | null;
    }
  ) => {

    setUpdatingId(regId);
    try {
      const res = await fetch("/api/v1/registrations/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: regId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update cell");
      mutate();
      toast.success("Lead updated ✓");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── File parsing ─────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rawRows = parseCsv(text);
      const parsed = rawRows.map(mapRawRow).filter(
        (r) => r.firstName || r.lastName || r.companyName
      );
      setImportRows(parsed);
      // Expand all countries by default
      const countries = new Set(parsed.map((r) => r.countryName ?? "Unknown"));
      setExpandedCountries(countries);
      toast.success(`Parsed ${parsed.length} leads from "${file.name}"`);
    };
    reader.readAsText(file);
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ─── Country groups for import preview ───────────────────────────────────
  const importCountryGroups = useMemo((): CountryGroup[] => {
    const map = new Map<string, CountryGroup>();
    for (const row of importRows) {
      const country = row.countryName?.trim() || "Unknown";
      if (!map.has(country)) {
        map.set(country, { country, rows: [], sectors: new Set() });
      }
      const g = map.get(country)!;
      g.rows.push(row);
      if (row.mainImportProduct1) g.sectors.add(row.mainImportProduct1);
      if (row.mainImportProduct2) g.sectors.add(row.mainImportProduct2);
    }
    return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country));
  }, [importRows]);

  // ─── Submit import ────────────────────────────────────────────────────────
  const handleImportSubmit = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      // Build records in the format the POST /api/registrations expects
      const records = importRows.map((r) => ({
        first_name: r.firstName ?? "",
        last_name: r.lastName ?? "",
        country_name: r.countryName ?? "",
        company_name: r.companyName ?? "",
        main_import_product_1: r.mainImportProduct1 ?? "",
        main_import_product_2: r.mainImportProduct2 ?? "",
        poc: r.poc ?? "",
        participant_mobile: r.participantMobile ?? "",
        participant_email: r.participantEmail ?? "",
        designation: r.designation ?? "",
        status: r.status ?? "Pending",
        sr_no: r.srNo ?? undefined,
      }));

      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const inserted = data.inserted ?? records.length;
      toast.success(`✓ ${inserted} leads imported successfully`);
      setImportRows([]);
      setImportFileName("");
      setShowImport(false);
      mutate();
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const validComments = [
    "Interested - Send Details",
    "Busy - Call Back Later",
    "Not Interested",
    "Wrong Number / Invalid Details",
  ];

  const formatFollowUpBadge = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(target);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    const formattedDate = target.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (diffDays < 0) {
      return {
        type: "overdue",
        label: `Overdue (${formattedDate})`,
        className: "bg-red-50 border-red-200 text-red-700 font-bold",
      };
    }
    if (diffDays === 0) {
      return {
        type: "today",
        label: `Due Today (${formattedDate})`,
        className: "bg-amber-50 border-amber-200 text-amber-800 font-bold animate-pulse",
      };
    }
    return {
      type: "scheduled",
      label: `Follow-up: ${formattedDate}`,
      className: "bg-blue-50 border-blue-200 text-blue-800 font-medium",
    };
  };


  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center justify-between">
        <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="search"
              placeholder="Search leads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9 py-2 text-sm bg-[var(--color-bg-primary)] border-[var(--color-border)] shadow-sm"
            />
          </div>

          {/* Country Filter (admin/supervisor only) */}
          {isAdmin && countries.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Globe size={13} className="text-[var(--color-text-tertiary)]" />
              <select
                value={selectedCountryFilter}
                onChange={(e) => setSelectedCountryFilter(e.target.value)}
                className="input py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-xs"
              >
                <option value="all">All Countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sector Filter (admin/supervisor only) */}
          {isAdmin && sectors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="text-[var(--color-text-tertiary)]" />
              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value)}
                className="input py-2 bg-[var(--color-bg-primary)] border-[var(--color-border)] text-xs"
              >
                <option value="all">All Sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Pending Email Filter */}
          <button
            onClick={() => setFilterPendingEmails(!filterPendingEmails)}
            className={`btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs ${
              filterPendingEmails
                ? "border-[var(--color-warning)] bg-[var(--color-warning-light)] text-[var(--color-warning)]"
                : ""
            }`}
          >
            <Mail size={13} />
            {filterPendingEmails ? "Showing Pending Emails" : "Filter Pending Emails"}
          </button>

          {/* Follow Up Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--color-text-tertiary)]" />
            <select
              value={filterFollowUp}
              onChange={(e) => setFilterFollowUp(e.target.value as any)}
              className={`input py-2 border text-xs font-semibold ${
                filterFollowUp !== "all"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : "bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              <option value="all">All Follow-ups</option>
              <option value="today">🎯 Due Today</option>
              <option value="overdue">🚨 Overdue</option>
              <option value="scheduled">📅 Scheduled</option>
              <option value="set">Dates Set</option>
            </select>
          </div>
        </div>


        <div className="flex gap-2 items-center">
          <button className="btn-secondary py-2" onClick={() => mutate()}>
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>

          {/* Admin: Import Excel Button */}
          {isAdmin && (
            <button
              className="btn-primary flex items-center gap-1.5 py-2 px-4 text-sm font-semibold"
              onClick={() => setShowImport(true)}
            >
              <Upload size={14} /> Import Excel / CSV
            </button>
          )}
        </div>
      </div>

      {/* ─── Import Panel (Admin only) ─────────────────────────── */}
      {showImport && isAdmin && (
        <div className="border border-[var(--color-border)] rounded-2xl shadow-lg overflow-hidden bg-[var(--color-surface)] animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 font-bold text-[var(--color-text-primary)]">
              <FileSpreadsheet size={18} className="text-[var(--color-accent)]" />
              Import Leads from Excel / CSV
            </div>
            <button
              onClick={() => { setShowImport(false); setImportRows([]); setImportFileName(""); }}
              className="btn-ghost p-1 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                isDragging
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] scale-[1.01]"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-primary)]/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center">
                <FileSpreadsheet size={28} className="text-[var(--color-accent)]" />
              </div>
              {importFileName ? (
                <div className="text-center">
                  <p className="font-bold text-[var(--color-accent)]">{importFileName}</p>
                  <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                    {importRows.length} leads parsed — click to replace file
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-semibold text-[var(--color-text-secondary)]">
                    Drag & drop your Excel export (CSV) here
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    or click to browse — supports CSV, Excel-exported CSV
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={onFileInputChange}
              />
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>Tip:</strong> Export your Excel file as CSV (UTF-8). Required columns:
                <span className="font-mono ml-1 bg-blue-100 px-1 rounded">First Name</span>,{" "}
                <span className="font-mono bg-blue-100 px-1 rounded">Last Name</span>,{" "}
                <span className="font-mono bg-blue-100 px-1 rounded">Country Name</span>,{" "}
                <span className="font-mono bg-blue-100 px-1 rounded">Company Name</span>,{" "}
                <span className="font-mono bg-blue-100 px-1 rounded">Main Import Product - 1</span>,{" "}
                <span className="font-mono bg-blue-100 px-1 rounded">POC</span>
              </div>
            </div>

            {/* Preview by Country */}
            {importCountryGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Preview by Country ({importCountryGroups.length} countries, {importRows.length} leads)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-[var(--color-accent)] hover:underline"
                      onClick={() => setExpandedCountries(new Set(importCountryGroups.map((g) => g.country)))}
                    >
                      Expand All
                    </button>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <button
                      className="text-xs text-[var(--color-accent)] hover:underline"
                      onClick={() => setExpandedCountries(new Set())}
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden max-h-[420px] overflow-y-auto custom-scrollbar">
                  {importCountryGroups.map((group) => {
                    const isExpanded = expandedCountries.has(group.country);
                    return (
                      <div key={group.country} className="border-b border-[var(--color-border)]/60 last:border-0">
                        {/* Country Header */}
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-primary)]/60 transition-colors text-left"
                          onClick={() => {
                            const next = new Set(expandedCountries);
                            isExpanded ? next.delete(group.country) : next.add(group.country);
                            setExpandedCountries(next);
                          }}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <Globe size={14} className="text-[var(--color-accent)]" />
                          <span className="font-bold text-sm text-[var(--color-text-primary)]">{group.country}</span>
                          <span className="ml-auto text-xs text-[var(--color-text-tertiary)] font-medium">
                            {group.rows.length} leads
                          </span>
                          {/* Sectors badges */}
                          <div className="flex gap-1 flex-wrap ml-2">
                            {Array.from(group.sectors).slice(0, 3).map((s) => (
                              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium border border-[var(--color-accent)]/20">
                                {s}
                              </span>
                            ))}
                            {group.sectors.size > 3 && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                +{group.sectors.size - 3} more
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Rows Table */}
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-[var(--color-bg-primary)]/30">
                                  <th className="text-left px-3 py-1.5 text-[var(--color-text-tertiary)] font-semibold w-8">#</th>
                                  <th className="text-left px-3 py-1.5 text-[var(--color-text-tertiary)] font-semibold">Name</th>
                                  <th className="text-left px-3 py-1.5 text-[var(--color-text-tertiary)] font-semibold">Company</th>
                                  <th className="text-left px-3 py-1.5 text-[var(--color-text-tertiary)] font-semibold">Sector / Product</th>
                                  <th className="text-left px-3 py-1.5 text-[var(--color-text-tertiary)] font-semibold">POC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.rows.map((r, idx) => (
                                  <tr key={idx} className={`border-t border-[var(--color-border)]/40 ${idx % 2 === 0 ? "" : "bg-[var(--color-bg-primary)]/20"}`}>
                                    <td className="px-3 py-1.5 text-[var(--color-text-tertiary)] font-mono">{r.srNo ?? idx + 1}</td>
                                    <td className="px-3 py-1.5 font-semibold text-[var(--color-text-primary)]">
                                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                                    </td>
                                    <td className="px-3 py-1.5 text-[var(--color-text-secondary)] max-w-[180px] truncate">
                                      {r.companyName || "—"}
                                    </td>
                                    <td className="px-3 py-1.5">
                                      {r.mainImportProduct1 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                                          {r.mainImportProduct1}
                                        </span>
                                      )}
                                      {r.mainImportProduct2 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-medium ml-1">
                                          {r.mainImportProduct2}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">{r.poc || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-1">
                  <button
                    className="btn-secondary py-2 px-5 text-sm"
                    onClick={() => { setImportRows([]); setImportFileName(""); }}
                  >
                    Clear
                  </button>
                  <button
                    className="btn-primary py-2 px-6 text-sm font-bold flex items-center gap-2"
                    onClick={handleImportSubmit}
                    disabled={importing}
                  >
                    {importing ? (
                      <><RefreshCw size={14} className="animate-spin" /> Importing…</>
                    ) : (
                      <><Upload size={14} /> Import {importRows.length} Leads</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Excel Sheet Grid ──────────────────────────────────────── */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm bg-[var(--color-surface)]">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="data-table w-full text-xs font-medium border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                <th className="w-10 text-center py-2.5 px-2">Sr</th>
                <th className="min-w-[130px] text-left">Company Name</th>
                <th className="min-w-[130px] text-left">Contact Person</th>
                <th className="min-w-[110px] text-left">Designation</th>
                <th className="min-w-[90px] text-left">Country</th>
                <th className="min-w-[110px] text-left">Mobile</th>
                <th className="min-w-[130px] text-left">E-mail</th>
                <th className="min-w-[110px] text-left">Website</th>
                <th className="min-w-[100px] text-left">Sector</th>
                <th className="min-w-[70px] text-left">POC</th>
                <th className="min-w-[160px] text-left text-blue-600 font-bold">1. Comment</th>
                <th className="min-w-[200px] text-left text-blue-600 font-bold">2. Remark</th>
                <th className="min-w-[140px] text-center text-blue-600 font-bold">3. Email Request</th>
                <th className="min-w-[170px] text-center text-blue-600 font-bold">4. Follow Up</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-[var(--color-text-tertiary)] font-medium">
                    <RefreshCw size={18} className="inline animate-spin mr-2" /> Loading leads…
                  </td>
                </tr>
              )}

              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-[var(--color-text-tertiary)] font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet size={32} className="text-[var(--color-border)]" />
                      {isCaller
                        ? "You have no leads assigned to your POC. Please contact your Team Lead."
                        : "No leads found matching the current filters."}
                    </div>
                  </td>
                </tr>
              )}

              {filteredRows.map((r, i) => {
                const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
                const isSent = r.email_request_status === "sent";

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors border-b border-[var(--color-border)]/60 ${
                      isSent
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : i % 2 === 0
                        ? "bg-white hover:bg-[var(--color-bg-primary)]/30"
                        : "bg-[var(--color-bg-primary)]/20 hover:bg-[var(--color-bg-primary)]/40"
                    }`}
                  >
                    {/* Sr */}
                    <td className="text-center font-mono text-[var(--color-text-tertiary)] py-2.5 px-2">
                      {r.sr_no ?? i + 1}
                    </td>

                    {/* Company Name */}
                    <td className="text-[var(--color-text-primary)] font-bold truncate max-w-[140px]" title={r.company_name}>
                      {r.company_name || "—"}
                    </td>

                    {/* Contact Person */}
                    <td className="font-semibold text-[var(--color-text-primary)]">{name}</td>

                    {/* Designation */}
                    <td className="text-[var(--color-text-secondary)] text-[11px] truncate max-w-[120px]" title={r.designation}>
                      {r.designation || "—"}
                    </td>

                    {/* Country */}
                    <td className="text-[var(--color-text-secondary)]">{r.country_name || "—"}</td>

                    {/* Mobile */}
                    <td className="text-[var(--color-text-secondary)] font-mono text-[11px]">
                      {r.participant_mobile ? (
                        <a href={`tel:${r.participant_mobile}`} className="text-[var(--color-accent)] hover:underline">
                          {r.participant_mobile}
                        </a>
                      ) : "—"}
                    </td>

                    {/* E-mail */}
                    <td className="text-[var(--color-text-secondary)] text-[11px] truncate max-w-[140px]" title={r.participant_email}>
                      {r.participant_email ? (
                        <a href={`mailto:${r.participant_email}`} className="text-[var(--color-accent)] hover:underline">
                          {r.participant_email}
                        </a>
                      ) : "—"}
                    </td>

                    {/* Website */}
                    <td className="text-[var(--color-text-secondary)] text-[11px] truncate max-w-[120px]" title={r.company_website}>
                      {r.company_website ? (
                        <a
                          href={r.company_website.startsWith("http") ? r.company_website : `https://${r.company_website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          {r.company_website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : "—"}
                    </td>

                    {/* Sector */}
                    <td className="text-[var(--color-text-secondary)]">
                      {r.main_import_product_1 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-medium whitespace-nowrap">
                          {r.main_import_product_1}
                        </span>
                      ) : "—"}
                    </td>

                    {/* POC */}
                    <td className="text-[var(--color-text-tertiary)] text-[10px] font-semibold">{r.poc || "—"}</td>

                    {/* Cell 1: Comment Dropdown */}
                    <td className="p-1">
                      <select
                        value={r.caller_comment || ""}
                        disabled={updatingId === r.id}
                        onChange={(e) => handleUpdate(r.id, { callerComment: e.target.value || null })}
                        className="w-full bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] focus:bg-white focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-light)] rounded-lg p-1.5 text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer outline-none transition-all"
                      >
                        <option value="">-- Choose Comment --</option>
                        {validComments.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>

                    {/* Cell 2: Remark Input */}
                    <td className="p-1">
                      <input
                        type="text"
                        defaultValue={r.caller_remark || ""}
                        disabled={updatingId === r.id}
                        onBlur={(e) => {
                          if (e.target.value !== (r.caller_remark || "")) {
                            handleUpdate(r.id, { callerRemark: e.target.value });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        placeholder="Type remark, press Enter to save…"
                        className="w-full bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)] focus:bg-white focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent-light)] rounded-lg py-1.5 px-2.5 text-xs outline-none transition-all text-[var(--color-text-primary)] font-medium"
                      />
                    </td>

                    {/* Cell 3: Email Request Flow */}
                    <td className="text-center p-1 font-semibold">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.email_request_status === "none" || !r.email_request_status ? (
                          <button
                            onClick={() => handleUpdate(r.id, { emailRequestStatus: "pending" })}
                            disabled={updatingId === r.id}
                            className="btn-secondary py-1 px-2.5 text-[0.7rem] bg-[var(--color-accent-light)] hover:bg-[var(--color-accent-hover)]/20 border-[var(--color-accent)]/30 text-[var(--color-accent)] font-bold flex items-center gap-1 rounded-md"
                          >
                            <Mail size={11} /> Request Email
                          </button>
                        ) : r.email_request_status === "pending" ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-amber-50 border border-amber-200 text-amber-800">
                              <Clock size={10} className="animate-pulse" /> Pending
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleUpdate(r.id, { emailRequestStatus: "sent" })}
                                disabled={updatingId === r.id}
                                className="btn-secondary py-0.5 px-1.5 text-[10px] bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-800 font-black rounded"
                              >
                                Approve Sent
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] bg-emerald-100 border border-emerald-200 text-emerald-800">
                            <CheckCircle size={10} /> Email Sent
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cell 4: Follow Up Date Picker */}
                    <td className="text-center p-1.5 min-w-[170px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 w-full justify-center">
                          <input
                            type="date"
                            value={r.follow_up_date ? new Date(r.follow_up_date).toISOString().slice(0, 10) : ""}
                            disabled={updatingId === r.id}
                            onChange={(e) => handleUpdate(r.id, { followUpDate: e.target.value || null })}
                            className="bg-[var(--color-bg-primary)]/60 border border-[var(--color-border)] focus:bg-white focus:border-[var(--color-accent)] rounded-lg py-1 px-2 text-[11px] font-semibold text-[var(--color-text-primary)] cursor-pointer outline-none transition-all shadow-sm"
                          />
                          {r.follow_up_date && (
                            <button
                              onClick={() => handleUpdate(r.id, { followUpDate: null })}
                              title="Clear Follow-up Date"
                              className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Quick Presets */}
                        <div className="flex gap-1 text-[9px]">
                          <button
                            type="button"
                            onClick={() => handleUpdate(r.id, { followUpDate: new Date().toISOString().slice(0, 10) })}
                            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] text-[var(--color-text-secondary)] font-medium transition-colors cursor-pointer"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const tom = new Date();
                              tom.setDate(tom.getDate() + 1);
                              handleUpdate(r.id, { followUpDate: tom.toISOString().slice(0, 10) });
                            }}
                            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] text-[var(--color-text-secondary)] font-medium transition-colors cursor-pointer"
                          >
                            Tomorrow
                          </button>
                        </div>

                        {/* Status Badge */}
                        {r.follow_up_date && (() => {
                          const badge = formatFollowUpBadge(r.follow_up_date);
                          if (!badge) return null;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shadow-xs ${badge.className}`}>
                              <Calendar size={10} /> {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)] flex justify-between items-center bg-[var(--color-bg-secondary)] font-medium">
          <span>Showing {filteredRows.length.toLocaleString()} Lead{filteredRows.length !== 1 ? "s" : ""}</span>
          {isCaller && (
            <span className="text-[var(--color-accent)]">★ Displaying leads where you are the POC</span>
          )}
          {isAdmin && (
            <span>
              {selectedCountryFilter !== "all" && `🌍 ${selectedCountryFilter} · `}
              {selectedSectorFilter !== "all" && `🏷 ${selectedSectorFilter} · `}
              Total: {rows.length} leads
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
