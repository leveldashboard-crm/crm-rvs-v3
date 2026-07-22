// ─── ConnectBuild CRM v3 — Notification & Escalation Engine ──────────────────
// notification-agent domain.
// Writes in-app notifications to the `notifications` DB table.
// Escalation ladder: caller → team_lead (2h) → regional_admin (6h)

import { db } from "@/db";
import { notifications, callLogs, users, appSettings } from "@/db/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export type NotificationType =
  | "follow_up_due"
  | "follow_up_missed"
  | "allocation_assigned"
  | "kpi_alert"
  | "escalation"
  | "idle_alert"
  | "daily_cap_reached"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationParams {
  eventId?: string;
  targetUserId: number;
  sourceUserId?: number | null;
  type: NotificationType;
  title: string;
  message?: string;
  payload?: Record<string, unknown>;
  priority?: NotificationPriority;
  escalationLevel?: number;
}

/**
 * Write an in-app notification. Never throws.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await db.insert(notifications).values({
      eventId: params.eventId ?? "bharat_buildcon_2026",
      targetUserId: params.targetUserId,
      sourceUserId: params.sourceUserId ?? null,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      payload: params.payload ?? null,
      priority: params.priority ?? "normal",
      escalationLevel: params.escalationLevel ?? 0,
      read: false,
    });
    logger.info("notification_created", {
      userId: params.targetUserId,
      action: "notification_created",
      entityType: "notification",
      message: `${params.type}: ${params.title}`,
    });
  } catch (err) {
    logger.error("notification_create_failed", err, { userId: params.targetUserId });
  }
}

/**
 * Mark notifications as read for a user.
 */
export async function markNotificationsRead(userId: number, notifIds?: number[]): Promise<void> {
  try {
    if (notifIds && notifIds.length > 0) {
      // Mark specific notifications
      for (const id of notifIds) {
        await db
          .update(notifications)
          .set({ read: true, readAt: new Date() })
          .where(and(eq(notifications.id, id), eq(notifications.targetUserId, userId)));
      }
    } else {
      // Mark ALL unread for this user
      await db
        .update(notifications)
        .set({ read: true, readAt: new Date() })
        .where(and(eq(notifications.targetUserId, userId), eq(notifications.read, false)));
    }
  } catch (err) {
    logger.error("mark_notifications_read_failed", err, { userId });
  }
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.targetUserId, userId), eq(notifications.read, false)));
    return result[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Escalation Engine ────────────────────────────────────────────────────────

/**
 * Scan for overdue follow-ups and fire escalation notifications.
 * Called by the heartbeat endpoint (/api/v1/presence) and optionally a cron job.
 *
 * Escalation ladder (thresholds from app_settings):
 *   level 0 → caller notified immediately when follow_up_due is reached
 *   level 1 → team_lead notified at N hours overdue (default 2h)
 *   level 2 → regional_admin notified at N hours overdue (default 6h)
 */
export async function runEscalationCheck(): Promise<{ escalated: number }> {
  let escalated = 0;
  try {
    // Get escalation thresholds from settings
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
    const level1Hours = settings?.escalationLevel1Hours ?? 2;
    const level2Hours = settings?.escalationLevel2Hours ?? 6;

    const now = new Date();
    const level1Cutoff = new Date(now.getTime() - level1Hours * 60 * 60 * 1000);
    const level2Cutoff = new Date(now.getTime() - level2Hours * 60 * 60 * 1000);

    // Find calls with overdue follow-ups that haven't been escalated yet
    const overdueLevel1 = await db
      .select({
        id: callLogs.id,
        callerId: callLogs.callerId,
        registrationId: callLogs.registrationId,
        followUpDue: callLogs.followUpDue,
        escalationLevel: callLogs.escalationLevel,
      })
      .from(callLogs)
      .where(
        and(
          eq(callLogs.followUpCompleted, false),
          lt(callLogs.followUpDue, level1Cutoff),
          sql`${callLogs.escalationLevel} < 1`,
          sql`${callLogs.followUpDue} IS NOT NULL`,
        )
      )
      .limit(50);

    for (const call of overdueLevel1) {
      if (!call.callerId) continue;

      // Find team lead for this caller (simplified: find a team_lead user in the system)
      const teamLeads = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, "team_lead"))
        .limit(5);

      for (const lead of teamLeads) {
        await createNotification({
          targetUserId: lead.id,
          sourceUserId: call.callerId,
          type: "escalation",
          title: "Follow-up Overdue — Escalated to You",
          message: `A follow-up is ${level1Hours}h+ overdue. Call Log #${call.id}`,
          payload: { callLogId: call.id, registrationId: call.registrationId, callerId: call.callerId },
          priority: "high",
          escalationLevel: 1,
        });
      }

      // Update escalation level
      await db
        .update(callLogs)
        .set({ escalationLevel: 1, updatedAt: now })
        .where(eq(callLogs.id, call.id));

      escalated++;
    }

    // Level 2: notify regional_admin
    const overdueLevel2 = await db
      .select({
        id: callLogs.id,
        callerId: callLogs.callerId,
        registrationId: callLogs.registrationId,
      })
      .from(callLogs)
      .where(
        and(
          eq(callLogs.followUpCompleted, false),
          lt(callLogs.followUpDue, level2Cutoff),
          sql`${callLogs.escalationLevel} < 2`,
          sql`${callLogs.followUpDue} IS NOT NULL`,
        )
      )
      .limit(50);

    for (const call of overdueLevel2) {
      const regionalAdmins = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, "regional_admin"))
        .limit(5);

      for (const ra of regionalAdmins) {
        await createNotification({
          targetUserId: ra.id,
          sourceUserId: call.callerId ?? null,
          type: "escalation",
          title: "CRITICAL: Follow-up Unresolved — Escalated to Regional Admin",
          message: `Follow-up is ${level2Hours}h+ overdue and unresolved. Immediate attention required. Call Log #${call.id}`,
          payload: { callLogId: call.id, registrationId: call.registrationId, callerId: call.callerId },
          priority: "urgent",
          escalationLevel: 2,
        });
      }

      await db
        .update(callLogs)
        .set({ escalationLevel: 2, updatedAt: now })
        .where(eq(callLogs.id, call.id));

      escalated++;
    }

    if (escalated > 0) {
      logger.info("escalation_check_completed", { message: `Escalated ${escalated} overdue follow-ups` });
    }
  } catch (err) {
    logger.error("escalation_check_failed", err);
  }
  return { escalated };
}
