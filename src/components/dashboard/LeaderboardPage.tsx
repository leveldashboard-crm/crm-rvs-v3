"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, Trophy, Flame, TrendingUp, Award } from "lucide-react";
import type { V3Role } from "@/lib/rbac";

interface KpiSnapshot {
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  performanceScore: string | null;
  totalContacted: number;
  totalConverted: number;
  followUpsMissed: number;
  avgQaScore: string | null;
  rank: number | null;
}

const MEDAL = ["🥇","🥈","🥉"];
const STREAK_TIERS = [
  { min: 20, label: "🔥 On Fire", color: "#dc2626" },
  { min: 10, label: "⚡ Momentum", color: "#d97706" },
  { min:  5, label: "✨ Streak",  color: "#0071e3" },
  { min:  0, label: "",           color: "" },
];

export default function LeaderboardPage({ role }: { role: V3Role }) {
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [kpiResp, settingsResp] = await Promise.all([
        fetch("/api/v1/kpi"),
        fetch("/api/settings"),
      ]);
      if (kpiResp.ok) {
        const d = await kpiResp.json();
        setSnapshots(d.snapshots ?? []);
      }
      if (settingsResp.ok) {
        const d = await settingsResp.json();
        setGamificationEnabled(d.settings?.feature_flag_gamification !== false);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top3 = snapshots.slice(0, 3);
  const rest = snapshots.slice(3);

  if (!gamificationEnabled) {
    return (
      <div style={{ padding: "24px 28px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div style={{ marginTop: 60 }}>
          <Trophy size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Leaderboard is disabled</h2>
          <p style={{ color: "var(--color-text-secondary)" }}>
            A Master Admin can enable gamification in Settings → Feature Flags.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={18} color="white" />
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Team Leaderboard</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Today's rankings — Performance Score = (Converted × 3) + (Contacted × 1) − (Missed × 2)
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-tertiary)" }}>
          <div className="animate-spin" style={{ width: 28, height: 28, border: "2px solid var(--color-border)", borderTopColor: "#f59e0b", borderRadius: "50%", margin: "0 auto 16px" }} />
          Loading leaderboard…
        </div>
      ) : snapshots.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-tertiary)" }}>
          <Trophy size={40} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No data yet today</div>
          <div style={{ fontSize: "0.875rem" }}>KPI snapshots will appear here as callers start their work</div>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 12, marginBottom: 24 }}>
              {/* 2nd */}
              {top3[1] && (
                <div className="glass-card" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #c0c0c0", marginTop: 24 }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🥈</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>{top3[1].userName ?? "Unknown"}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0071e3" }}>{top3[1].performanceScore ? parseFloat(top3[1].performanceScore).toFixed(0) : "—"}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)" }}>Performance Score</div>
                </div>
              )}
              {/* 1st */}
              {top3[0] && (
                <div className="glass-card-elevated" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #f59e0b" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🥇</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>{top3[0].userName ?? "Unknown"}</div>
                  <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#f59e0b" }}>{top3[0].performanceScore ? parseFloat(top3[0].performanceScore).toFixed(0) : "—"}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", marginBottom: 8 }}>Performance Score</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <span style={{ fontSize: "0.75rem", color: "#1d9a50", fontWeight: 600 }}>✓ {top3[0].totalConverted} conv</span>
                    <span style={{ fontSize: "0.75rem", color: "#0071e3", fontWeight: 600 }}>📞 {top3[0].totalContacted} calls</span>
                  </div>
                </div>
              )}
              {/* 3rd */}
              {top3[2] && (
                <div className="glass-card" style={{ padding: 20, textAlign: "center", borderTop: "3px solid #cd7f32", marginTop: 24 }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🥉</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>{top3[2].userName ?? "Unknown"}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0071e3" }}>{top3[2].performanceScore ? parseFloat(top3[2].performanceScore).toFixed(0) : "—"}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)" }}>Performance Score</div>
                </div>
              )}
            </div>
          )}

          {/* Full Rankings Table */}
          <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} color="var(--color-accent)" /> Full Rankings
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Name</th><th>Score</th><th>Called</th><th>Converted</th><th>Missed FU</th><th>QA Avg</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const streak = STREAK_TIERS.find(t => (s.totalContacted ?? 0) >= t.min);
                  return (
                    <tr key={s.userId ?? i} style={{ background: i < 3 ? `${i === 0 ? "rgba(245,158,11,0.05)" : i === 1 ? "rgba(192,192,192,0.05)" : "rgba(205,127,50,0.05)"}` : "transparent" }}>
                      <td style={{ fontWeight: 800, color: i < 3 ? ["#f59e0b","#c0c0c0","#cd7f32"][i] : "var(--color-text-tertiary)" }}>
                        {MEDAL[i] ?? `#${i+1}`}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.userName ?? "Unknown"}</div>
                        {streak?.label && (
                          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: streak.color }}>
                            {streak.label}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 800, color: "#0071e3", fontSize: "1rem" }}>
                        {s.performanceScore ? parseFloat(s.performanceScore).toFixed(0) : "—"}
                      </td>
                      <td>{s.totalContacted}</td>
                      <td style={{ color: "#1d9a50", fontWeight: 700 }}>{s.totalConverted}</td>
                      <td style={{ color: s.followUpsMissed > 0 ? "#dc2626" : "inherit" }}>{s.followUpsMissed}</td>
                      <td>{s.avgQaScore ? `${parseFloat(s.avgQaScore).toFixed(1)}/5` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
