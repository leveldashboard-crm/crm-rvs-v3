"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, AlertTriangle, Info, Zap, Clock } from "lucide-react";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  priority: string;
  read: boolean;
  escalationLevel: number;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  escalation:        <AlertTriangle size={14} />,
  follow_up_due:     <Clock size={14} />,
  follow_up_missed:  <AlertTriangle size={14} />,
  allocation_assigned: <Zap size={14} />,
  kpi_alert:         <Info size={14} />,
  idle_alert:        <Clock size={14} />,
  system:            <Info size={14} />,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#dc2626",
  high:   "#d97706",
  normal: "#0071e3",
  low:    "#6e6e73",
};

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const resp = await fetch("/api/v1/notifications?limit=20");
      if (!resp.ok) return;
      const data = await resp.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch full list when panel opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAllRead = async () => {
    await fetch("/api/v1/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const markRead = async (id: number) => {
    await fetch("/api/v1/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative",
          width: 34, height: 34,
          borderRadius: "50%",
          border: "1px solid var(--color-border-strong)",
          background: open ? "var(--color-accent-light)" : "var(--color-surface)",
          color: open ? "var(--color-accent)" : "var(--color-text-secondary)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease",
        }}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            minWidth: 16, height: 16,
            background: "#dc2626", color: "white",
            borderRadius: 99, fontSize: "0.6rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", border: "2px solid var(--color-surface)",
            animation: "scaleIn 0.18s ease",
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 100 }}
          />
          <div
            id="notification-panel"
            style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              width: 360, maxHeight: 480,
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)",
              zIndex: 200,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              animation: "fadeIn 0.18s ease",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={15} color="var(--color-accent)" />
                <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Notifications</span>
                {unreadCount > 0 && (
                  <span className="badge badge-warning" style={{ fontSize: "0.65rem" }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    title="Mark all read"
                    style={{
                      padding: "4px 8px", borderRadius: 6, border: "none",
                      background: "var(--color-accent-light)", color: "var(--color-accent)",
                      cursor: "pointer", fontSize: "0.7rem", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <Check size={11} /> All read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: 4, borderRadius: 6, border: "none",
                    background: "transparent", color: "var(--color-text-tertiary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: "32px 16px", textAlign: "center",
                  color: "var(--color-text-tertiary)", fontSize: "0.8125rem",
                }}>
                  <Bell size={28} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div>No notifications</div>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    id={`notif-${notif.id}`}
                    onClick={() => !notif.read && markRead(notif.id)}
                    style={{
                      padding: "11px 16px",
                      borderBottom: "1px solid var(--color-border)",
                      background: notif.read ? "transparent" : "rgba(0,113,227,0.03)",
                      cursor: notif.read ? "default" : "pointer",
                      transition: "background 0.15s ease",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent-light)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = notif.read ? "transparent" : "rgba(0,113,227,0.03)"; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: `${PRIORITY_COLORS[notif.priority] ?? "#0071e3"}18`,
                      color: PRIORITY_COLORS[notif.priority] ?? "#0071e3",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {ICON_MAP[notif.type] ?? <Info size={14} />}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.8125rem", fontWeight: notif.read ? 500 : 700,
                        color: "var(--color-text-primary)", lineHeight: 1.3,
                        display: "flex", justifyContent: "space-between", gap: 8,
                      }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span style={{
                            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                            background: "var(--color-accent)", marginTop: 4,
                          }} />
                        )}
                      </div>
                      {notif.message && (
                        <div style={{
                          fontSize: "0.75rem", color: "var(--color-text-secondary)",
                          lineHeight: 1.4, marginTop: 2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {notif.message}
                        </div>
                      )}
                      <div style={{
                        fontSize: "0.65rem", color: "var(--color-text-tertiary)", marginTop: 4,
                        display: "flex", gap: 6, alignItems: "center",
                      }}>
                        <span>{timeAgo(notif.createdAt)}</span>
                        {notif.escalationLevel > 0 && (
                          <span style={{
                            background: "#dc262618", color: "#dc2626",
                            padding: "1px 5px", borderRadius: 4, fontWeight: 600, fontSize: "0.6rem",
                          }}>
                            ESC L{notif.escalationLevel}
                          </span>
                        )}
                        {notif.priority === "urgent" && (
                          <span style={{
                            background: "#dc262618", color: "#dc2626",
                            padding: "1px 5px", borderRadius: 4, fontWeight: 600, fontSize: "0.6rem",
                          }}>
                            URGENT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
