"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, RefreshCw, Plus, Clock, Coffee, Wifi, WifiOff, User } from "lucide-react";
import { canManageWorkforce } from "@/lib/rbac";
import type { V3Role } from "@/lib/rbac";

interface ShiftRecord {
  id: number;
  userId: number;
  shiftName: string | null;
  timezone: string | null;
  startTime: string;
  endTime: string;
  days: string | null;
  isActive: boolean;
  userName: string | null;
  userRole: string | null;
}

interface ActiveUser {
  id: number;
  name: string | null;
  role: string;
  presenceStatus: string | null;
  lastSeenAt: string | null;
  region: string | null;
  continent: string | null;
}

const PRESENCE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  online:    { label: "Online",    color: "#1d9a50", icon: <Wifi size={12} /> },
  idle:      { label: "Idle",      color: "#d97706", icon: <Clock size={12} /> },
  on_break:  { label: "On Break",  color: "#0071e3", icon: <Coffee size={12} /> },
  offline:   { label: "Offline",   color: "#6e6e73", icon: <WifiOff size={12} /> },
};

function minutesSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export default function WorkforcePage({ role }: { role: V3Role }) {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string | null }[]>([]);
  const [form, setForm] = useState({ userId: "", shiftName: "", startTime: "09:00", endTime: "18:00", timezone: "Asia/Kolkata" });
  const canManage = canManageWorkforce(role);

  const fetchData = useCallback(async () => {
    try {
      const [shiftsResp, kpiResp] = await Promise.all([
        fetch("/api/v1/shifts"),
        fetch("/api/v1/kpi"),
      ]);
      if (shiftsResp.ok) {
        const d = await shiftsResp.json();
        setShifts(d.shifts ?? []);
      }
      if (kpiResp.ok) {
        const d = await kpiResp.json();
        setActiveUsers(d.activeCallers ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    if (canManage) {
      fetch("/api/admin/users").then(r => r.json()).then(d => setAllUsers(d.users ?? [])).catch(() => {});
    }
  }, [fetchData, canManage]);

  // Auto-refresh every 30s for live presence
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const createShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) return;
    await fetch("/api/v1/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: parseInt(form.userId), shiftName: form.shiftName || "Default", startTime: form.startTime, endTime: form.endTime, timezone: form.timezone }),
    });
    setShowCreate(false);
    fetchData();
  };

  const onlineCount   = activeUsers.filter(u => u.presenceStatus === "online").length;
  const idleCount     = activeUsers.filter(u => u.presenceStatus === "idle").length;
  const breakCount    = activeUsers.filter(u => u.presenceStatus === "on_break").length;
  const offlineCount  = activeUsers.filter(u => !u.presenceStatus || u.presenceStatus === "offline").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0891b2, #0071e3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCog size={18} color="white" />
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Workforce & Shifts</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Shift scheduling, real-time presence, and attendance tracking
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchData} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          {canManage && <button onClick={() => setShowCreate(s => !s)} className="btn-primary"><Plus size={14} /> Add Shift</button>}
        </div>
      </div>

      {/* Presence Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Online", value: onlineCount, color: "#1d9a50", bg: "rgba(29,154,80,0.10)" },
          { label: "Idle", value: idleCount, color: "#d97706", bg: "rgba(217,119,6,0.10)" },
          { label: "On Break", value: breakCount, color: "#0071e3", bg: "rgba(0,113,227,0.10)" },
          { label: "Offline", value: offlineCount, color: "#6e6e73", bg: "rgba(110,110,115,0.10)" },
        ].map(stat => (
          <div key={stat.label} className="kpi-card" style={{ textAlign: "center", borderLeft: `3px solid ${stat.color}` }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Live Presence Grid */}
        <div className="glass-card" style={{ padding: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1d9a50", boxShadow: "0 0 6px #1d9a5088", display: "inline-block" }} />
            Live Team Presence
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>Loading…</div>
            ) : activeUsers.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>No team members found</div>
            ) : (
              activeUsers.map(user => {
                const status = user.presenceStatus ?? "offline";
                const meta = PRESENCE_META[status] ?? PRESENCE_META.offline;
                const minsAgo = minutesSince(user.lastSeenAt);
                const isStale = minsAgo !== null && minsAgo > 5;

                return (
                  <div key={user.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    borderRadius: 8, background: "var(--color-bg-primary)",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${meta.color}33, #5856d633)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.7rem", fontWeight: 700, color: meta.color,
                    }}>
                      {(user.name ?? "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user.name ?? "Unknown"}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--color-text-tertiary)" }}>
                        {user.role} {user.continent ? `· ${user.continent}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 20,
                        background: isStale ? "rgba(110,110,115,0.10)" : `${meta.color}18`,
                        color: isStale ? "#6e6e73" : meta.color,
                        fontSize: "0.65rem", fontWeight: 700,
                      }}>
                        {meta.icon} {isStale ? "Offline" : meta.label}
                      </div>
                      {minsAgo !== null && (
                        <div style={{ fontSize: "0.6rem", color: "var(--color-text-tertiary)", marginTop: 2 }}>
                          {minsAgo < 1 ? "just now" : `${minsAgo}m ago`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Shifts */}
        <div>
          {showCreate && canManage && (
            <div className="glass-card" style={{ padding: 16, marginBottom: 16, animation: "fadeIn 0.2s ease" }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 14 }}>Add Shift</h3>
              <form onSubmit={createShift} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="label">User *</label>
                  <select className="input" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} required>
                    <option value="">Select user…</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label className="label">Start Time</label>
                    <input className="input" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Time</label>
                    <input className="input" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Shift Name</label>
                  <input className="input" value={form.shiftName} onChange={e => setForm(f => ({ ...f, shiftName: e.target.value }))} placeholder="e.g., IST Morning" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="btn-primary">Save Shift</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="glass-card" style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 14 }}>Shift Schedule</h3>
            {shifts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>
                {canManage ? 'Click "Add Shift" to schedule shifts' : "No shifts configured"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {shifts.map(shift => (
                  <div key={shift.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--color-bg-primary)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0,113,227,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Clock size={13} color="#0071e3" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{shift.userName} — {shift.shiftName ?? "Shift"}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)" }}>
                        {shift.startTime} – {shift.endTime} ({shift.timezone ?? "IST"})
                      </div>
                    </div>
                    {!shift.isActive && (
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6e6e73", background: "rgba(110,110,115,0.10)", padding: "2px 6px", borderRadius: 10 }}>Inactive</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
