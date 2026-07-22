"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, RefreshCw, Plus, Clock, Coffee, Wifi, WifiOff } from "lucide-react";
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

// Global 50 Countries Pool for Pitching & Country Allocation
const GLOBAL_50_COUNTRIES = [
  "India", "UAE", "Saudi Arabia", "Germany", "Japan", "USA", "UK", "Kenya", "Nigeria", "Brazil",
  "Nepal", "Qatar", "Oman", "South Korea", "China", "Singapore", "Australia", "Canada", "Italy", "France",
  "Spain", "Egypt", "Turkey", "Indonesia", "Malaysia", "Vietnam", "Thailand", "Mexico", "South Africa", "Ghana",
  "Tanzania", "Ethiopia", "Chile", "Colombia", "Argentina", "Netherlands", "Belgium", "Sweden", "Switzerland", "Poland",
  "Czech Republic", "Austria", "Greece", "Romania", "Philippines", "Pakistan", "Sri Lanka", "Kazakhstan", "Uzbekistan", "Kuwait"
];

function CountryAllocationSection({ allUsers, canManage, onSave }: { allUsers: any[]; canManage: boolean; onSave: () => void }) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userCountries, setUserCountries] = useState<string[]>([]);
  const [countryPool, setCountryPool] = useState<string[]>(GLOBAL_50_COUNTRIES);
  const [newCountryName, setNewCountryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSelectUser = (u: any) => {
    setSelectedUser(u);
    setUserCountries(u.assignedCountries ?? []);
    setMessage("");
  };

  const toggleCountry = (country: string) => {
    setUserCountries(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  };

  const handleAddCustomCountry = (e: React.FormEvent) => {
    e.preventDefault();
    const c = newCountryName.trim();
    if (!c) return;
    if (!countryPool.includes(c)) {
      setCountryPool(prev => [c, ...prev]);
    }
    if (!userCountries.includes(c)) {
      setUserCountries(prev => [...prev, c]);
    }
    setNewCountryName("");
  };

  const handleSaveAllocations = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          assignedCountries: userCountries
        }),
      });
      if (res.ok) {
        setMessage("Country allocations saved successfully!");
        onSave();
      } else {
        setMessage("Failed to save allocations");
      }
    } catch {
      setMessage("Network error saving allocations");
    }
    setSaving(false);
  };

  const filteredCountries = countryPool.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="glass-card" style={{ padding: 18, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: "0.95rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            🌐 User Country Allocation & Access Control
          </h3>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.78rem", margin: "2px 0 0 0" }}>
            Allocate specific countries to team members. Users only access data & comment on their assigned countries.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* User Selector List */}
        <div style={{ background: "var(--color-bg-primary)", padding: 12, borderRadius: 10, border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>
            Select Team Member
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {allUsers.map(u => {
              const count = (u.assignedCountries ?? []).length;
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", borderRadius: 8, textAlign: "left",
                    background: isSelected ? "rgba(0,113,227,0.12)" : "transparent",
                    border: isSelected ? "1px solid #0071e3" : "1px solid transparent",
                    cursor: "pointer", transition: "all 0.15s ease"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: isSelected ? 700 : 600 }}>{u.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--color-text-tertiary)" }}>{u.role}</div>
                  </div>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "rgba(0,113,227,0.1)", color: "#0071e3" }}>
                    {count} countries
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Country Checkbox Selector */}
        <div>
          {selectedUser ? (
            <div style={{ background: "var(--color-bg-primary)", padding: 14, borderRadius: 10, border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>Allocations for {selectedUser.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginLeft: 8 }}>
                    ({userCountries.length} selected)
                  </span>
                </div>
                {canManage && (
                  <button type="button" onClick={handleSaveAllocations} disabled={saving} className="btn-primary" style={{ padding: "4px 12px", fontSize: "0.75rem" }}>
                    {saving ? "Saving…" : "Save Country Allocations"}
                  </button>
                )}
              </div>

              {message && (
                <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(29,154,80,0.12)", color: "#1d9a50", fontSize: "0.75rem", fontWeight: 600, marginBottom: 10 }}>
                  {message}
                </div>
              )}

              {/* Add Custom Country Form */}
              {canManage && (
                <form onSubmit={handleAddCustomCountry} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Create new country (e.g. New Zealand)..."
                    value={newCountryName}
                    onChange={e => setNewCountryName(e.target.value)}
                    className="input"
                    style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem" }}
                  />
                  <button type="submit" className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>+ Add Country</button>
                </form>
              )}

              {/* Country Filter Search */}
              <input
                type="text"
                placeholder="Search from 50 global countries..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "4px 8px", fontSize: "0.75rem", marginBottom: 10 }}
              />

              {/* Grid of 50 Countries */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {filteredCountries.map(c => {
                  const checked = userCountries.includes(c);
                  return (
                    <label
                      key={c}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6,
                        background: checked ? "rgba(0,113,227,0.1)" : "var(--color-bg-secondary)",
                        border: checked ? "1px solid #0071e3" : "1px solid var(--color-border)",
                        fontSize: "0.72rem", cursor: "pointer", fontWeight: checked ? 700 : 400
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCountry(c)}
                        disabled={!canManage}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-tertiary)", fontSize: "0.85rem", background: "var(--color-bg-primary)", borderRadius: 10 }}>
              Select a team member on the left to allocate country access & data filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkforcePage({ role }: { role: V3Role }) {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
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

  const fetchUsers = useCallback(() => {
    fetch("/api/admin/users").then(r => r.json()).then(d => setAllUsers(d.users ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [fetchData, fetchUsers]);

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
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Workforce & Country Allocations</h1>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Shift scheduling, country allocation, and real-time presence tracking
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

      {/* Presence & Shift Cards */}
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

      {/* Country Allocation Manager Section */}
      <CountryAllocationSection allUsers={allUsers} canManage={canManage} onSave={fetchUsers} />
    </div>
  );
}
