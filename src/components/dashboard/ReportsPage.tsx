"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw, Download, Filter, BarChart2, TrendingUp, AlertTriangle, Globe } from "lucide-react";
import type { V3Role } from "@/lib/rbac";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type ReportType = "funnel" | "performer" | "country" | "missed_followups";

interface FunnelRow { leadTemperature: string | null; status: string | null; count: number; }
interface PerformerRow { userName: string | null; performanceScore: string | null; totalContacted: number; totalConverted: number; followUpsMissed: number; avgQaScore: string | null; rank: number | null; }
interface CountryRow { country: string | null; region: string | null; total: number; hot: number; warm: number; cold: number; }
interface MissedRow { callLogId: number; callerName: string | null; followUpDue: string | null; escalationLevel: number; }

const REPORT_TYPES: { type: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: "funnel",          label: "Delegate Funnel",    icon: <TrendingUp size={15} />, desc: "Cold→Warm→Hot→Registered conversion" },
  { type: "performer",       label: "Team Performance",   icon: <BarChart2 size={15} />,  desc: "Top & bottom performers by KPI" },
  { type: "country",         label: "By Country",         icon: <Globe size={15} />,      desc: "Registration breakdown by country" },
  { type: "missed_followups",label: "Missed Follow-Ups",  icon: <AlertTriangle size={15} />, desc: "Overdue follow-ups & escalation status" },
];

const TEMP_COLORS: Record<string, string> = { Hot: "#dc2626", Warm: "#d97706", Cold: "#0071e3", "(null)": "#6e6e73" };

export default function ReportsPage({ role }: { role: V3Role }) {
  const [activeReport, setActiveReport] = useState<ReportType>("funnel");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const resp = await fetch(`/api/v1/reports?${params}`);
      if (resp.ok) {
        const d = await resp.json();
        setData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchReport(activeReport); }, [activeReport, fetchReport]);

  const exportCsv = () => {
    const rows = (data.funnelData ?? data.performers ?? data.byCountry ?? data.missed ?? []) as Record<string, unknown>[];
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${activeReport}_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const funnelData = (data.funnelData ?? []) as FunnelRow[];
  const performers = (data.performers ?? []) as PerformerRow[];
  const byCountry  = (data.byCountry ?? []) as CountryRow[];
  const missed     = (data.missed ?? []) as MissedRow[];

  // Funnel pivot by temperature
  const tempPivot = ["Hot","Warm","Cold"].map(t => ({
    name: t,
    count: funnelData.filter(r => r.leadTemperature === t).reduce((s,r) => s + r.count, 0),
  }));
  const topCountries = byCountry.slice(0, 10);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #5856d6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} color="white" />
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Reports & Business Intelligence</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Funnel analytics, cohort insights, and performance exports
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fetchReport(activeReport)} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={exportCsv} className="btn-secondary"><Download size={14} /> Export CSV</button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="tab-strip" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        {REPORT_TYPES.map(rt => (
          <button key={rt.type} className={`tab-item ${activeReport === rt.type ? "active" : ""}`} onClick={() => setActiveReport(rt.type)}>
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={14} color="var(--color-text-tertiary)" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="label" style={{ margin: 0, whiteSpace: "nowrap" }}>From</label>
          <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 150 }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="label" style={{ margin: 0, whiteSpace: "nowrap" }}>To</label>
          <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: 150 }} />
        </div>
        <button className="btn-primary" onClick={() => fetchReport(activeReport)}>Apply</button>
        <button className="btn-ghost" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-tertiary)" }}>
          <div className="animate-spin" style={{ width: 28, height: 28, border: "2px solid var(--color-border)", borderTopColor: "#7c3aed", borderRadius: "50%", margin: "0 auto 16px" }} />
          Generating report…
        </div>
      ) : (
        <>
          {/* FUNNEL REPORT */}
          {activeReport === "funnel" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="glass-card" style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 16 }}>Lead Temperature Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={tempPivot} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(props) => { const d = (props as { name?: string; value?: number }); return `${d.name ?? ""}: ${d.value ?? 0}`; }}>
                      {tempPivot.map((entry) => <Cell key={entry.name} fill={TEMP_COLORS[entry.name] ?? "#6e6e73"} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card" style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 16 }}>Funnel by Status & Temperature</h3>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>Temperature</th><th>Status</th><th>Count</th></tr></thead>
                    <tbody>
                      {funnelData.slice(0, 30).map((r, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{ background: `${TEMP_COLORS[r.leadTemperature ?? "(null)"] ?? "#6e6e73"}18`, color: TEMP_COLORS[r.leadTemperature ?? "(null)"] ?? "#6e6e73", padding: "2px 7px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700 }}>
                              {r.leadTemperature ?? "Unscored"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.775rem" }}>{r.status ?? "—"}</td>
                          <td style={{ fontWeight: 700 }}>{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PERFORMER REPORT */}
          {activeReport === "performer" && (
            <div>
              <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 16 }}>Team Performance Score</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={performers.slice(0,10)} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="userName" tick={{ fontSize: 10 }} width={100} />
                    <Bar dataKey="performanceScore" fill="#0071e3" radius={[0,4,4,0]} />
                    <Tooltip />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="data-table">
                  <thead><tr><th>Rank</th><th>Caller</th><th>Performance</th><th>Contacted</th><th>Converted</th><th>Missed FU</th><th>Avg QA</th></tr></thead>
                  <tbody>
                    {performers.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 800, color: i < 3 ? "#d97706" : "var(--color-text-secondary)" }}>#{p.rank ?? i+1}</td>
                        <td style={{ fontWeight: 600 }}>{p.userName ?? "Unknown"}</td>
                        <td style={{ fontWeight: 800, color: "#0071e3" }}>{p.performanceScore ? `${parseFloat(p.performanceScore).toFixed(1)}` : "—"}</td>
                        <td>{p.totalContacted}</td>
                        <td>{p.totalConverted}</td>
                        <td style={{ color: p.followUpsMissed > 0 ? "#dc2626" : "inherit" }}>{p.followUpsMissed}</td>
                        <td>{p.avgQaScore ? `${parseFloat(p.avgQaScore).toFixed(1)}/5` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COUNTRY REPORT */}
          {activeReport === "country" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="glass-card" style={{ padding: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 16 }}>Top 10 Countries</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topCountries}>
                    <XAxis dataKey="country" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="hot" name="Hot" fill="#dc2626" stackId="a" />
                    <Bar dataKey="warm" name="Warm" fill="#d97706" stackId="a" />
                    <Bar dataKey="cold" name="Cold" fill="#0071e3" stackId="a" radius={[4,4,0,0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="data-table">
                  <thead><tr><th>Country</th><th>Region</th><th>Total</th><th>🔴 Hot</th><th>🟡 Warm</th><th>🔵 Cold</th></tr></thead>
                  <tbody>
                    {byCountry.slice(0,20).map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.country ?? "Unknown"}</td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: "0.775rem" }}>{r.region ?? "—"}</td>
                        <td style={{ fontWeight: 700 }}>{r.total}</td>
                        <td style={{ color: "#dc2626" }}>{r.hot}</td>
                        <td style={{ color: "#d97706" }}>{r.warm}</td>
                        <td style={{ color: "#0071e3" }}>{r.cold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MISSED FOLLOW-UPS REPORT */}
          {activeReport === "missed_followups" && (
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
              {missed.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)" }}>
                  <AlertTriangle size={28} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div style={{ fontWeight: 600 }}>No missed follow-ups 🎉</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Call Log #</th><th>Caller</th><th>Due Date</th><th>Overdue By</th><th>Escalation</th></tr></thead>
                  <tbody>
                    {missed.map((r, i) => {
                      const dueDate = r.followUpDue ? new Date(r.followUpDue) : null;
                      const hoursOverdue = dueDate ? Math.floor((Date.now() - dueDate.getTime()) / 3600000) : 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>#{r.callLogId}</td>
                          <td>{r.callerName ?? "Unknown"}</td>
                          <td style={{ fontSize: "0.775rem", color: "var(--color-text-secondary)" }}>{dueDate?.toLocaleString() ?? "—"}</td>
                          <td style={{ fontWeight: 700, color: hoursOverdue > 6 ? "#dc2626" : "#d97706" }}>{hoursOverdue}h</td>
                          <td>
                            <span style={{ background: r.escalationLevel > 0 ? "rgba(220,38,38,0.10)" : "rgba(110,110,115,0.10)", color: r.escalationLevel > 0 ? "#dc2626" : "#6e6e73", padding: "2px 7px", borderRadius: 10, fontSize: "0.65rem", fontWeight: 700 }}>
                              {r.escalationLevel === 0 ? "None" : `Level ${r.escalationLevel}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
