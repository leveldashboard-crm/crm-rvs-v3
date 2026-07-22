// ─── /api/v1/notifications — In-app notification CRUD ────────────────────────
// Phase 6: Notification & Escalation Engine

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { markNotificationsRead, getUnreadCount } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/v1/notifications — fetch notification list + unread count
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30"), 100);
  const unreadOnly = url.searchParams.get("unread") === "1";

  try {
    const conditions = [eq(notifications.targetUserId, userId)];
    if (unreadOnly) conditions.push(eq(notifications.read, false));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const unreadCount = await getUnreadCount(userId);

    return NextResponse.json({ notifications: rows, unreadCount });
  } catch (err) {
    logger.error("notifications_get_failed", err, { userId });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/v1/notifications — mark as read
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const body = await req.json().catch(() => ({}));
  // body.ids = specific IDs to mark read, or undefined = mark all
  const ids: number[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;

  await markNotificationsRead(userId, ids);

  logger.info("notifications_marked_read", {
    userId,
    message: ids ? `Marked ${ids.length} notifications read` : "Marked all notifications read",
  });

  return NextResponse.json({ ok: true });
}
