"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { ClipboardList, Plus, Lock, Unlock, CheckCircle, Clock, User, RefreshCw, ChevronDown } from "lucide-react";
import { canAllocate } from "@/lib/rbac";
import type { V3Role } from "@/lib/rbac";

const fetcher = (url: string) => fetch(url).then((r) => r.json());


interface TaskBatch {
  id: number;
  sector?: string;
  name: string;
  assignedToId: number | null;
  assignedToName: string | null;
  country: string | null;
  continent: string | null;
  timeLink?: string | null;
  status: string;
  completionPercent?: number;
  totalDelegates: number;
  completedDelegates: number;
  lockedBy: number | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface TaskPhaseItem {
  id: number;
  name: string;
  status: "not_started" | "in_progress" | "done";
}

function TaskPhasesChecklist({ taskId, initialPercent, onPercentChange }: { taskId: number; initialPercent?: number; onPercentChange: (p: number) => void }) {
  const { data, mutate } = useSWR<{ phases: TaskPhaseItem[] }>(`/api/v1/tasks/${taskId}/phases`, fetcher);
  const [adding, setAdding] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");

  const phases = data?.phases ?? [];

  const handleToggle = async (phaseId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "not_started" : "done";
    const res = await fetch(`/api/v1/tasks/${taskId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, status: nextStatus }),
    });
    if (res.ok) {
      const result = await res.json();
      onPercentChange(result.completionPercent);
      mutate();
    }
  };

  const handleAddPhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhaseName.trim()) return;

    const res = await fetch(`/api/v1/tasks/${taskId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPhaseName.trim() }),
    });
    if (res.ok) {
      setNewPhaseName("");
      setAdding(false);
      mutate();
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)]/60 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Task Execution Phases</span>
        <button type="button" onClick={() => setAdding((s) => !s)} className="text-[10px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">
          <Plus size={11} /> Add Phase
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAddPhase} className="flex gap-2">
          <input
            type="text"
            placeholder="Custom phase name…"
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.target.value)}
            className="input py-1 px-2 text-xs flex-1"
          />
          <button type="submit" className="btn-primary py-1 px-2 text-[10px]">Add</button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5">
        {phases.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleToggle(p.id, p.status)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
              p.status === "done"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                : p.status === "in_progress"
                ? "bg-blue-500/10 border-blue-500/30 text-blue-700"
                : "bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${p.status === "done" ? "bg-emerald-500" : p.status === "in_progress" ? "bg-blue-500" : "bg-gray-300"}`} />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}


interface User {
  id: number;
  name: string | null;
  role: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pending",     color: "#6e6e73", bg: "rgba(110,110,115,0.10)" },
  in_progress: { label: "In Progress", color: "#0071e3", bg: "rgba(0,113,227,0.10)"  },
  completed:   { label: "Completed",   color: "#1d9a50", bg: "rgba(29,154,80,0.10)"  },
  cancelled:   { label: "Cancelled",   color: "#dc2626", bg: "rgba(220,38,38,0.10)"  },
};

export default function AllocationPage({ role }: { role: V3Role }) {
  const [batches, setBatches] = useState<TaskBatch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", assignedToId: "", country: "", continent: "", dueAt: "", notes: "" });

  const canCreate = canAllocate(role);

  const fetchBatches = useCallback(async () => {
    try {
      const resp = await fetch("/api/v1/allocation");
      if (resp.ok) {
        const data = await resp.json();
        setBatches(data.batches ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const resp = await fetch("/api/admin/users");
      if (resp.ok) {
        const data = await resp.json();
        setUsers((data.users ?? []).filter((u: User) => ["caller", "team_lead"].includes(u.role)));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBatches();
    if (canCreate) fetchUsers();
  }, [fetchBatches, fetchUsers, canCreate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.assignedToId) return;
    setCreating(true);
    try {
      const resp = await fetch("/api/v1/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          assignedToId: parseInt(form.assignedToId),
          country: form.country || null,
          continent: form.continent || null,
          dueAt: form.dueAt || null,
          notes: form.notes || null,
        }),
      });
      if (resp.ok) {
        setShowCreate(false);
        setForm({ name: "", assignedToId: "", country: "", continent: "", dueAt: "", notes: "" });
        fetchBatches();
      }
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (batchId: number, status: string) => {
    await fetch("/api/v1/allocation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, action: "status_update", status }),
    });
    fetchBatches();
  };

  const completedBatches = batches.filter(b => b.status === "completed");
  const activeBatches = batches.filter(b => b.status !== "completed" && b.status !== "cancelled");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #0071e3, #5856d6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ClipboardList size={18} color="white" />
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Task Allocation</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Assign delegates to callers, track completion, manage TTL locks
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchBatches} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
          {canCreate && (
            <button onClick={() => setShowCreate(s => !s)} className="btn-primary">
              <Plus size={14} /> New Batch
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && canCreate && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, animation: "fadeIn 0.2s ease" }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 16 }}>Create Task Batch</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Batch Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., India Batch 1 — Week 3" required />
              </div>
              <div>
                <label className="label">Assign To *</label>
                <select className="input" value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} required>
                  <option value="">Select caller…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g., India" />
              </div>
              <div>
                <label className="label">Continent</label>
                <input className="input" value={form.continent} onChange={e => setForm(f => ({ ...f, continent: e.target.value }))} placeholder="e.g., Asia" />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input className="input" type="datetime-local" value={form.dueAt} onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create Batch"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Batches", value: batches.length, color: "#0071e3" },
          { label: "Active", value: activeBatches.length, color: "#d97706" },
          { label: "Completed", value: completedBatches.length, color: "#1d9a50" },
          { label: "Delegates Assigned", value: batches.reduce((s, b) => s + (b.totalDelegates ?? 0), 0), color: "#7c3aed" },
        ].map(stat => (
          <div key={stat.label} className="kpi-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Batch List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)" }}>
          <div className="animate-spin" style={{ width: 24, height: 24, border: "2px solid var(--color-border)", borderTopColor: "var(--color-accent)", borderRadius: "50%", margin: "0 auto 12px" }} />
          Loading batches…
        </div>
      ) : batches.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <ClipboardList size={32} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No task batches yet</div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            {canCreate ? 'Click "New Batch" to create your first allocation' : "No batches have been assigned to you yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {batches.map(batch => {
            const statusMeta = STATUS_META[batch.status] ?? STATUS_META.pending;
            const progress = batch.totalDelegates > 0 ? (batch.completedDelegates / batch.totalDelegates) * 100 : 0;
            const isLocked = batch.lockedBy != null && batch.lockExpiresAt && new Date(batch.lockExpiresAt) > new Date();
            const isDue = batch.dueAt && new Date(batch.dueAt) < new Date() && batch.status !== "completed";

            return (
              <div key={batch.id} className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{batch.name}</span>
                      {batch.sector && (
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700, background: "rgba(0,113,227,0.10)", color: "#0071e3", border: "1px solid rgba(0,113,227,0.25)" }}>
                          {batch.sector}
                        </span>
                      )}
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700, background: statusMeta.bg, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                      {isLocked && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(217,119,6,0.10)", color: "#d97706", padding: "2px 7px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700 }}>
                          <Lock size={10} /> Locked
                        </span>
                      )}
                      {isDue && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(220,38,38,0.10)", color: "#dc2626", padding: "2px 7px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700 }}>
                          <Clock size={10} /> Overdue
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: "0.775rem", color: "var(--color-text-secondary)", flexWrap: "wrap", alignItems: "center" }}>
                      {batch.assignedToName && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <User size={11} /> {batch.assignedToName}
                        </span>
                      )}
                      {batch.country && <span>🌍 {batch.country}</span>}
                      {batch.timeLink && (
                        <a href={batch.timeLink} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-accent)", fontWeight: 600 }}>
                          📅 Booking Link
                        </a>
                      )}
                      {batch.dueAt && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> Due: {new Date(batch.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress + Status actions */}
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: 120 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: 4 }}>
                      {batch.completionPercent ?? Math.round(progress)}% phase completed
                    </div>
                    <div style={{ width: 120, height: 6, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${batch.completionPercent ?? progress}%`, background: (batch.completionPercent ?? progress) === 100 ? "#1d9a50" : "var(--color-accent)", borderRadius: 3, transition: "width 0.3s ease" }} />
                    </div>
                    {canCreate && batch.status === "in_progress" && (
                      <button
                        onClick={() => updateStatus(batch.id, "completed")}
                        style={{ marginTop: 8, fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, border: "1px solid #1d9a50", background: "rgba(29,154,80,0.08)", color: "#1d9a50", cursor: "pointer", fontWeight: 600, marginLeft: "auto" }}
                      >
                        <CheckCircle size={11} /> Mark Done
                      </button>
                    )}
                    {canCreate && batch.status === "pending" && (
                      <button
                        onClick={() => updateStatus(batch.id, "in_progress")}
                        style={{ marginTop: 8, fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, border: "1px solid #0071e3", background: "rgba(0,113,227,0.08)", color: "#0071e3", cursor: "pointer", fontWeight: 600, marginLeft: "auto" }}
                      >
                        Start
                      </button>
                    )}
                  </div>
                </div>

                {batch.notes && (
                  <div style={{ marginTop: 10, fontSize: "0.775rem", color: "var(--color-text-secondary)", padding: "8px 10px", background: "var(--color-bg-primary)", borderRadius: 8, borderLeft: "3px solid var(--color-border)" }}>
                    {batch.notes}
                  </div>
                )}

                {/* Task Execution Phases Checklist */}
                <TaskPhasesChecklist taskId={batch.id} initialPercent={batch.completionPercent} onPercentChange={() => fetchBatches()} />
              </div>


            );
          })}
        </div>
      )}
    </div>
  );
}
