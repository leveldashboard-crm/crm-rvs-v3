"use client";

import { useState, useCallback } from "react";
import { Calendar, Target, Plus, RefreshCw, UserCheck, Award, Flag, Globe } from "lucide-react";
import useSWR from "swr";
import { canManageRoster, canManageAllUsers } from "@/lib/rbac";
import type { V3Role } from "@/lib/rbac";

interface RosterEntry {
  id: number;
  week: string;
  userId: number;
  userName: string;
  sector: string;
  country: string;
}

interface TargetEntry {
  id: number;
  userId: number;
  userName: string;
  sector: string;
  period: "3m" | "6m" | "9m";
  goal: number;
  currentAttainment: number;
}

interface UserItem {
  id: number;
  name: string;
  role: string;
  sector?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RosterTargetPage({ role }: { role: V3Role }) {
  const [selectedWeek, setSelectedWeek] = useState("2026-W30");
  const [selectedSector, setSelectedSector] = useState("all");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  // Form states
  const [assignUserId, setAssignUserId] = useState("");
  const [assignSector, setAssignSector] = useState("Bharat Buildcon");
  const [assignCountry, setAssignCountry] = useState("");

  const [targetUserId, setTargetUserId] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<"3m" | "6m" | "9m">("3m");
  const [targetGoal, setTargetGoal] = useState("");
  const [targetSector, setTargetSector] = useState("Bharat Buildcon");

  const canEditRoster = canManageRoster(role);
  const canEditTargets = canManageAllUsers(role);

  const { data: rosterData, mutate: mutateRoster } = useSWR<{ roster: RosterEntry[] }>(
    `/api/v1/roster?week=${selectedWeek}`,
    fetcher
  );

  const { data: targetData, mutate: mutateTargets } = useSWR<{ targets: TargetEntry[] }>(
    "/api/v1/targets",
    fetcher
  );

  const { data: usersData } = useSWR<{ users: UserItem[] }>("/api/admin/users", fetcher);

  const rosterList = rosterData?.roster ?? [];
  const targetList = targetData?.targets ?? [];
  const usersList = usersData?.users ?? [];

  const filteredRoster = selectedSector === "all"
    ? rosterList
    : rosterList.filter((r) => r.sector.toLowerCase() === selectedSector.toLowerCase());

  const filteredTargets = selectedSector === "all"
    ? targetList
    : targetList.filter((t) => !t.sector || t.sector.toLowerCase() === selectedSector.toLowerCase());

  const handleAssignRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignCountry) return;

    await fetch("/api/v1/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week: selectedWeek,
        userId: parseInt(assignUserId),
        sector: assignSector,
        country: assignCountry,
      }),
    });

    setShowAssignModal(false);
    setAssignCountry("");
    mutateRoster();
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !targetGoal) return;

    await fetch("/api/v1/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: parseInt(targetUserId),
        period: targetPeriod,
        goal: parseInt(targetGoal),
        sector: targetSector,
      }),
    });

    setShowTargetModal(false);
    setTargetGoal("");
    mutateTargets();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto animate-fade-in flex flex-col gap-8">
      {/* Header & Sector Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white shadow-xs">
              <Calendar size={20} />
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">Roster &amp; Long-Term Targets</h1>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Weekly caller schedules and 3-Month, 6-Month, 9-Month goal attainment tracker
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="input text-xs py-2 px-3 bg-[var(--color-bg-primary)] border-[var(--color-border)] font-semibold"
          >
            <option value="all">🌍 All Sectors</option>
            <option value="Export Calling">Export Calling</option>
            <option value="Bharat Buildcon">Bharat Buildcon</option>
            <option value="Food Pro">Food Pro</option>
          </select>
          <button onClick={() => { mutateRoster(); mutateTargets(); }} className="btn-secondary text-xs py-2">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Section 1: Weekly Roster ── */}
      <div className="glass-card p-6 border border-[var(--color-border)] rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-[var(--color-accent)]" />
            <h2 className="font-bold text-base text-[var(--color-text-primary)]">Weekly Roster Schedule ({selectedWeek})</h2>
          </div>
          {canEditRoster && (
            <button onClick={() => setShowAssignModal(true)} className="btn-primary text-xs py-1.5 px-3">
              <Plus size={13} /> Assign Roster
            </button>
          )}
        </div>

        {filteredRoster.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center gap-2 border border-dashed border-[var(--color-border)] rounded-xl">
            <Calendar size={28} className="opacity-30" />
            No roster assignments for {selectedWeek} in selected sector.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRoster.map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-between shadow-2xs">
                <div>
                  <div className="font-bold text-sm text-[var(--color-text-primary)]">{item.userName}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-medium flex items-center gap-1 mt-0.5">
                    <Globe size={11} /> {item.country} • <span className="text-[var(--color-accent)] font-semibold">{item.sector}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  Assigned
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Long-Term Targets ── */}
      <div className="glass-card p-6 border border-[var(--color-border)] rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-[#5856d6]" />
            <h2 className="font-bold text-base text-[var(--color-text-primary)]">3-Month, 6-Month, 9-Month Targets</h2>
          </div>
          {canEditTargets && (
            <button onClick={() => setShowTargetModal(true)} className="btn-primary text-xs py-1.5 px-3">
              <Plus size={13} /> Set Target Goal
            </button>
          )}
        </div>

        {filteredTargets.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center gap-2 border border-dashed border-[var(--color-border)] rounded-xl">
            <Target size={28} className="opacity-30" />
            No targets configured for the selected sector.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((t) => {
              const progress = t.goal > 0 ? Math.min(100, Math.round((t.currentAttainment / t.goal) * 100)) : 0;
              return (
                <div key={t.id} className="p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)] block">{t.userName}</span>
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-medium">{t.sector ?? "General"}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#5856d6]/10 text-[#5856d6] border border-[#5856d6]/20">
                      {t.period.toUpperCase()} Goal
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--color-text-secondary)]">Progress</span>
                      <span className="text-[var(--color-text-primary)] font-bold">{t.currentAttainment} / {t.goal} ({progress}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0071e3] to-[#1d9a50] transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roster Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="glass-card w-full max-w-md bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)]">
            <h3 className="font-bold text-base mb-4">Assign Weekly Roster</h3>
            <form onSubmit={handleAssignRoster} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">Caller *</label>
                <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required className="input w-full">
                  <option value="">Select caller…</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold mb-1 block">Sector *</label>
                <select value={assignSector} onChange={(e) => setAssignSector(e.target.value)} className="input w-full">
                  <option value="Export Calling">Export Calling</option>
                  <option value="Bharat Buildcon">Bharat Buildcon</option>
                  <option value="Food Pro">Food Pro</option>
                </select>
              </div>
              <div>
                <label className="font-bold mb-1 block">Country *</label>
                <input type="text" placeholder="e.g. Germany" value={assignCountry} onChange={(e) => setAssignCountry(e.target.value)} required className="input w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="glass-card w-full max-w-md bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)]">
            <h3 className="font-bold text-base mb-4">Set Caller Target Goal</h3>
            <form onSubmit={handleSaveTarget} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">Caller *</label>
                <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required className="input w-full">
                  <option value="">Select caller…</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold mb-1 block">Period *</label>
                <select value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value as any)} className="input w-full">
                  <option value="3m">3-Month Target</option>
                  <option value="6m">6-Month Target</option>
                  <option value="9m">9-Month Target</option>
                </select>
              </div>
              <div>
                <label className="font-bold mb-1 block">Sector</label>
                <select value={targetSector} onChange={(e) => setTargetSector(e.target.value)} className="input w-full">
                  <option value="Export Calling">Export Calling</option>
                  <option value="Bharat Buildcon">Bharat Buildcon</option>
                  <option value="Food Pro">Food Pro</option>
                </select>
              </div>
              <div>
                <label className="font-bold mb-1 block">Goal (Leads / Calls) *</label>
                <input type="number" min="1" placeholder="e.g. 50" value={targetGoal} onChange={(e) => setTargetGoal(e.target.value)} required className="input w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTargetModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Set Target</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
