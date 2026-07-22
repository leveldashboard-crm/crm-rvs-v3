"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, RefreshCw, Plus, BarChart2, User, CheckCircle } from "lucide-react";
import { canSubmitQAScore } from "@/lib/rbac";
import type { V3Role } from "@/lib/rbac";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

interface QAScore {
  id: number;
  callLogId: number | null;
  auditorName: string | null;
  callerId: number | null;
  callerName: string | null;
  scriptAdherence: number | null;
  tone: number | null;
  dataAccuracy: number | null;
  customerHandling: number | null;
  overallScore: string | null;
  notes: string | null;
  scoredAt: string;
}

interface WeeklySummary {
  callerId: number | null;
  callerName: string | null;
  avgScore: string;
  scoreCount: number;
}

const RUBRIC_LABELS = ["Script Adherence", "Tone & Professionalism", "Data Accuracy", "Customer Handling"];
const RUBRIC_FIELDS = ["scriptAdherence", "tone", "dataAccuracy", "customerHandling"] as const;

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          style={{ background: "none", border: "none", padding: 0, cursor: onChange ? "pointer" : "default",
            color: n <= value ? "#f59e0b" : "var(--color-border-strong)", fontSize: "1.1rem" }}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function QAPage({ role }: { role: V3Role }) {
  const [scores, setScores] = useState<QAScore[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ callLogId: "", callerId: "", callerName: "", scriptAdherence: 3, tone: 3, dataAccuracy: 3, customerHandling: 3, notes: "" });
  const canScore = canSubmitQAScore(role);

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch("/api/v1/qa?limit=30");
      if (resp.ok) {
        const d = await resp.json();
        setScores(d.scores ?? []);
        setWeekly(d.weeklySummary ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const resp = await fetch("/api/v1/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callLogId: parseInt(form.callLogId),
          callerId: parseInt(form.callerId),
          callerName: form.callerName || null,
          scriptAdherence: form.scriptAdherence,
          tone: form.tone,
          dataAccuracy: form.dataAccuracy,
          customerHandling: form.customerHandling,
          notes: form.notes || null,
        }),
      });
      if (resp.ok) {
        setShowForm(false);
        setForm({ callLogId: "", callerId: "", callerName: "", scriptAdherence: 3, tone: 3, dataAccuracy: 3, customerHandling: 3, notes: "" });
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Radar data for latest score
  const latestScore = scores[0];
  const radarData = latestScore ? [
    { subject: "Script", value: latestScore.scriptAdherence ?? 0, fullMark: 5 },
    { subject: "Tone",   value: latestScore.tone ?? 0, fullMark: 5 },
    { subject: "Accuracy", value: latestScore.dataAccuracy ?? 0, fullMark: 5 },
    { subject: "Handling", value: latestScore.customerHandling ?? 0, fullMark: 5 },
  ] : [];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={18} color="white" />
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>QA Scorecard</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Call quality auditing · Only QA Auditors and Master Admin can submit scores
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchData} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          {canScore && <button onClick={() => setShowForm(s => !s)} className="btn-primary"><Plus size={14} /> Score Call</button>}
        </div>
      </div>

      {/* Score Form */}
      {showForm && canScore && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, animation: "fadeIn 0.2s ease" }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 16 }}>Submit QA Score</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label className="label">Call Log ID *</label>
                <input className="input" value={form.callLogId} onChange={e => setForm(f => ({ ...f, callLogId: e.target.value }))} placeholder="Call log #" required type="number" />
              </div>
              <div>
                <label className="label">Caller ID *</label>
                <input className="input" value={form.callerId} onChange={e => setForm(f => ({ ...f, callerId: e.target.value }))} placeholder="User ID" required type="number" />
              </div>
              <div>
                <label className="label">Caller Name</label>
                <input className="input" value={form.callerName} onChange={e => setForm(f => ({ ...f, callerName: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {RUBRIC_FIELDS.map((field, i) => (
                <div key={field}>
                  <label className="label">{RUBRIC_LABELS[i]}</label>
                  <StarRating value={form[field]} onChange={v => setForm(f => ({ ...f, [field]: v }))} />
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", marginTop: 2 }}>
                    {form[field]} / 5
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="label">Notes</label>
              <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional quality notes…" style={{ resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting…" : <><CheckCircle size={14} /> Submit Score</>}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Weekly Leaderboard */}
        <div className="glass-card" style={{ padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={15} color="#0071e3" /> Weekly QA Averages
          </h3>
          {weekly.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>No scores this week</div>
          ) : weekly.map((w, i) => (
            <div key={w.callerId ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? "linear-gradient(135deg, #f59e0b, #d97706)" : "var(--color-bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: i < 3 ? "white" : "var(--color-text-tertiary)", flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{w.callerName ?? `Caller #${w.callerId}`}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)" }}>{w.scoreCount} score{w.scoreCount !== 1 ? "s" : ""} this week</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: parseFloat(w.avgScore) >= 4 ? "#1d9a50" : parseFloat(w.avgScore) >= 3 ? "#d97706" : "#dc2626" }}>
                {parseFloat(w.avgScore).toFixed(1)}
                <span style={{ fontSize: "0.65rem", color: "var(--color-text-tertiary)", fontWeight: 400 }}>/5</span>
              </div>
            </div>
          ))}
        </div>

        {/* Radar Chart for latest score */}
        <div className="glass-card" style={{ padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 14 }}>
            Latest Score Breakdown {latestScore ? `— ${latestScore.callerName ?? "Caller"}` : ""}
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                <Radar name="Score" dataKey="value" stroke="#0071e3" fill="#0071e3" fillOpacity={0.2} />
                <Tooltip formatter={(v) => [`${v}/5`, "Score"]} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>
              <Star size={28} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>No scores yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Score History */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, fontSize: "0.875rem" }}>
          Score History
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--color-text-tertiary)" }}>Loading…</div>
        ) : scores.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>No scores recorded</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Caller</th><th>Script</th><th>Tone</th><th>Accuracy</th><th>Handling</th><th>Overall</th><th>Auditor</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.map(score => (
                <tr key={score.id}>
                  <td style={{ fontWeight: 600 }}>{score.callerName ?? `#${score.callerId}`}</td>
                  <td><StarRating value={score.scriptAdherence ?? 0} /></td>
                  <td><StarRating value={score.tone ?? 0} /></td>
                  <td><StarRating value={score.dataAccuracy ?? 0} /></td>
                  <td><StarRating value={score.customerHandling ?? 0} /></td>
                  <td style={{ fontWeight: 800, color: parseFloat(score.overallScore ?? "0") >= 4 ? "#1d9a50" : "#d97706" }}>
                    {score.overallScore ? `${parseFloat(score.overallScore).toFixed(1)}/5` : "—"}
                  </td>
                  <td style={{ color: "var(--color-text-secondary)", fontSize: "0.775rem" }}>{score.auditorName}</td>
                  <td style={{ color: "var(--color-text-tertiary)", fontSize: "0.75rem" }}>{new Date(score.scoredAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
