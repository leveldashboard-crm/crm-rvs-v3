"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "next-auth";
import {
  Globe, Plane, Settings, LogOut, ChevronRight,
  LayoutDashboard, Menu, X, MessageSquare, BarChart2, Users,
  ShieldAlert, Clock, Mail, ClipboardList, UserCog, Star,
  FileText, Activity, Coffee,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/layout/NotificationBell";
import {
  normalizeRole, getRoleMeta,
  canViewDashboard, canViewAnalytics, canViewDelegates, canViewTravel,
  canUseMailer, canViewChat, canViewOperationLog, canViewSettings,
  canViewAllocation, canViewWorkforce, canViewQA, canViewReports, canViewLeaderboard,
} from "@/lib/rbac";

// ─── Navigation Items ─────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  guard: (role: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",              icon: <LayoutDashboard size={17} />, label: "CRM Home",             desc: "KPIs & Command Center",  guard: canViewDashboard },
  { href: "/analytics",     icon: <BarChart2 size={17} />,       label: "Analytics",            desc: "Sector & DB/Vujis",      guard: canViewAnalytics },
  { href: "/allocation",    icon: <ClipboardList size={17} />,   label: "Task Allocation",      desc: "Batches & assignments",  guard: canViewAllocation },
  { href: "/roster-targets",icon: <Star size={17} />,            label: "Roster & Targets",     desc: "Schedules & 3/6/9m goals",guard: canViewAllocation },
  { href: "/workforce",     icon: <UserCog size={17} />,         label: "Workforce",            desc: "Shifts & Attendance",    guard: canViewWorkforce },
  { href: "/qa",            icon: <Star size={17} />,            label: "QA Scorecard",         desc: "Call quality scoring",   guard: canViewQA },
  { href: "/delegates",     icon: <Users size={17} />,           label: "Registered Delegates", desc: "View delegate list",     guard: canViewDelegates },
  { href: "/travel",        icon: <Plane size={17} />,           label: "Travel Desk",          desc: "Flights, Hotels, Visas", guard: canViewTravel },
  { href: "/mailer",        icon: <Mail size={17} />,            label: "Concierge Mailer",     desc: "Send Invites & Docs",    guard: canUseMailer },
  { href: "/reports",       icon: <FileText size={17} />,        label: "Reports & BI",         desc: "Analytics & Exports",    guard: canViewReports },
  { href: "/leaderboard",   icon: <Activity size={17} />,        label: "Leaderboard",          desc: "Rankings & Streaks",     guard: canViewLeaderboard },
  { href: "/chat",          icon: <MessageSquare size={17} />,   label: "Team Chat",            desc: "Enterprise Messaging",   guard: canViewChat },
  { href: "/operation-log", icon: <ShieldAlert size={17} />,     label: "Operation Log",        desc: "Audit & Permissions",    guard: canViewOperationLog },
  { href: "/settings",      icon: <Settings size={17} />,        label: "Settings",             desc: "Integration Config",     guard: canViewSettings },
];


const DEFAULT_TIMEOUT_MINUTES = 30;
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

interface Props {
  session: Session;
  children: React.ReactNode;
}

export default function AppShell({ session, children }: Props) {

  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gasConnected, setGasConnected] = useState<boolean | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<"online" | "idle" | "on_break">("online");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userRole = normalizeRole((session.user as { role?: string })?.role);
  const roleMeta = getRoleMeta(userRole);

  // Initialize sidebar collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("crm_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  };

  // ── Fetch settings ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(({ settings }) => {
        const mins = parseInt(settings?.session_timeout_minutes ?? String(DEFAULT_TIMEOUT_MINUTES));
        if (!isNaN(mins) && mins > 0) setTimeoutMinutes(mins);
        setGasConnected(!!(settings?.gas_web_app_url));
      })
      .catch(() => { setGasConnected(false); });
  }, []);

  // ── Presence Heartbeat ──────────────────────────────────────────────────────
  const sendHeartbeat = useCallback(async (status: "online" | "idle" | "on_break" = "online") => {
    try {
      await fetch("/api/v1/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // ignore — heartbeat failures are non-fatal
    }
  }, []);

  useEffect(() => {
    sendHeartbeat("online");
    heartbeatRef.current = setInterval(() => sendHeartbeat(presenceStatus), HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sendHeartbeat, presenceStatus]);

  // ── Inactivity Timer ────────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (warningRef.current)  clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timerRef.current = null; warningRef.current = null; countdownRef.current = null;
    setCountdown(null);
  }, []);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    const totalMs = timeoutMinutes * 60 * 1000;
    const warningMs = Math.max(totalMs - 60_000, totalMs * 0.9);

    warningRef.current = setTimeout(() => {
      const warningSeconds = Math.round((totalMs - warningMs) / 1000);
      setCountdown(warningSeconds);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev == null || prev <= 1) return null;
          return prev - 1;
        });
      }, 1000);
    }, warningMs);

    timerRef.current = setTimeout(() => {
      clearAllTimers();
      signOut({ redirect: true, callbackUrl: "/login" });
    }, totalMs);
  }, [timeoutMinutes, clearAllTimers]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      if (countdown !== null) setCountdown(null);
      resetTimer();
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileSidebarOpen(false);
      }
    };

    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));
    window.addEventListener("resize", handleResize);
    setTimeout(() => resetTimer(), 0);
    return () => {
      clearAllTimers();
      events.forEach(e => document.removeEventListener(e, handleActivity));
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMinutes, resetTimer]);


  const handleSignOut = async () => {
    clearAllTimers();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  const userInitials = (session.user?.name ?? session.user?.email ?? "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const visibleNavItems = NAV_ITEMS.filter(item => item.guard(userRole));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Inactivity Warning Banner ─────────────────────────────────────────── */}
      {countdown !== null && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "linear-gradient(90deg,#ff9500,#ff3b30)",
          color: "white", padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: "0.875rem", fontWeight: 600, boxShadow: "0 2px 12px rgba(255,59,48,0.4)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={16} />
            Session expiring in {countdown}s due to inactivity
          </span>
          <button
            onClick={() => { setCountdown(null); resetTimer(); }}
            style={{
              background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.5)",
              color: "white", borderRadius: "6px", padding: "4px 14px", cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 600,
            }}
          >
            Stay Logged In
          </button>
        </div>
      )}

      {/* ── Mobile overlay ───────────────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-200"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className={`sidebar fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-2xl md:shadow-none transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? "w-[72px] min-w-[72px]" : "w-[252px] min-w-[252px]"
        } ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ paddingTop: countdown !== null ? "44px" : "0" }}
      >
        {/* Logo & Mobile Close button */}
        <div className={`px-4 py-4 border-b border-[var(--color-border)] flex items-center ${sidebarCollapsed ? "justify-center flex-col gap-2" : "justify-between"}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_3px_10px_rgba(0,113,227,0.35)] bg-gradient-to-br from-[#0071e3] to-[#5856d6]">
              <Globe size={18} color="white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-[0.95rem] font-bold text-[var(--color-text-primary)] leading-tight tracking-tight">
                  DelegateConnect
                </div>
                <div className="text-[0.7rem] text-[var(--color-text-tertiary)] tracking-wide uppercase font-semibold mt-0.5">
                  Enterprise CRM v3
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Hamburger Toggle */}
            <button
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors cursor-pointer"
              title={sidebarCollapsed ? "Expand sidebar" : "Retract sidebar"}
            >
              <Menu size={18} />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
              title="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Session info */}
        {!sidebarCollapsed && (
          <div className="px-5 py-2 border-b border-[var(--color-border)]/50 flex items-center gap-1.5 bg-[var(--color-bg-primary)]/50">
            <Clock size={11} className="text-[var(--color-text-tertiary)] shrink-0" />
            <span className="text-[0.65rem] text-[var(--color-text-tertiary)] font-medium">
              Auto-logout: {timeoutMinutes}min inactivity
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto custom-scrollbar">
          {!sidebarCollapsed && (
            <p className="text-[0.65rem] font-bold tracking-widest uppercase text-[var(--color-text-tertiary)] px-3 pb-2">
              Modules
            </p>
          )}
          {visibleNavItems.map(({ href, icon, label, desc }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={sidebarCollapsed ? label : undefined}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center rounded-xl mb-1 transition-all duration-150 ease-in-out no-underline ${
                  sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold"
                    : "text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span className={`shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-70"}`}>{icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[0.8125rem] tracking-tight ${isActive ? "font-semibold" : "font-medium"}`}>{label}</div>
                      <div className="text-[0.65rem] text-[var(--color-text-tertiary)] leading-tight mt-[2px]">{desc}</div>
                    </div>
                    {isActive && <ChevronRight size={14} className="shrink-0 opacity-50" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: user + break + sign out */}
        <div className={`p-3 border-t border-[var(--color-border)] ${sidebarCollapsed ? "flex flex-col items-center gap-3" : ""}`}>
          {/* GAS Status dot */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: gasConnected === null ? "#8e8e93" : gasConnected ? "#34c759" : "#ff9500",
                  boxShadow: gasConnected ? "0 0 6px #34c75988" : "none",
                }}
              />
              <span className="text-[0.65rem] font-medium text-[var(--color-text-tertiary)]">
                {gasConnected === null ? "Checking GAS…" : gasConnected ? "GAS: Connected" : "GAS: Not configured"}
              </span>
            </div>
          )}

          {/* Break toggle for callers */}
          {(userRole === "caller" || userRole === "team_lead") && (
            <button
              onClick={() => {
                const next = presenceStatus === "on_break" ? "online" : "on_break";
                setPresenceStatus(next);
                sendHeartbeat(next);
              }}
              title={presenceStatus === "on_break" ? "Resume Work" : "Go on Break"}
              style={{
                width: "100%", marginBottom: sidebarCollapsed ? 0 : 10,
                padding: sidebarCollapsed ? "6px" : "6px 10px", borderRadius: 8,
                border: `1px solid ${presenceStatus === "on_break" ? "#d97706" : "var(--color-border-strong)"}`,
                background: presenceStatus === "on_break" ? "rgba(217,119,6,0.10)" : "transparent",
                color: presenceStatus === "on_break" ? "#d97706" : "var(--color-text-secondary)",
                cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <Coffee size={13} />
              {!sidebarCollapsed && (presenceStatus === "on_break" ? "Resume Work" : "Go on Break")}
            </button>
          )}

          {/* User row */}
          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-2" : "gap-3"}`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
              style={{ background: `linear-gradient(135deg, ${roleMeta.color}, #5856d6)` }}
              title={session.user?.name ?? "User"}
            >
              {userInitials}
            </div>

            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-[0.85rem] font-semibold text-[var(--color-text-primary)] truncate">
                  {session.user?.name ?? "User"}
                </div>
                {/* Role badge */}
                <div style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "1px 7px", borderRadius: 20,
                  background: roleMeta.bg, color: roleMeta.color,
                  border: `1px solid ${roleMeta.borderColor}`,
                  fontSize: "0.6rem", fontWeight: 700, marginTop: 2,
                  letterSpacing: "0.02em",
                }}>
                  {roleMeta.shortLabel}
                </div>
              </div>
            )}

            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-all flex items-center shrink-0 cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-[252px]"
        }`}
        style={{ paddingTop: countdown !== null ? "44px" : "0" }}
      >
        {/* Desktop topbar with Retract / Expand Hamburger Button */}
        <div className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-[var(--color-border)]/40 bg-[var(--color-bg-secondary)]/30 backdrop-blur-md">
          <button
            onClick={toggleSidebar}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title={sidebarCollapsed ? "Expand sidebar" : "Retract sidebar"}
          >
            <Menu size={15} className="text-[var(--color-accent)]" />
            <span>{sidebarCollapsed ? "Expand Sidebar" : "Retract Sidebar"}</span>
          </button>

          <NotificationBell />
        </div>

        {/* Mobile topbar */}
        <div className="mobile-topbar md:hidden px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] backdrop-blur-xl sticky top-0 z-[45] flex items-center justify-between shadow-xs">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] rounded-lg transition-colors"
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="font-semibold text-sm">DelegateConnect</div>
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

