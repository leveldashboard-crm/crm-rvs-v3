// ─── /api/v1/shifts — Shift Management CRUD ──────────────────────────────────
// Phase 4: Workforce & Shift Management

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { normalizeRole, canManageWorkforce, canViewWorkforce } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canViewWorkforce(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const eventId = url.searchParams.get("eventId") ?? "bharat_buildcon_2026";

  try {
    const rows = await db
      .select({
        id: shifts.id,
        userId: shifts.userId,
        shiftName: shifts.shiftName,
        timezone: shifts.timezone,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        days: shifts.days,
        isActive: shifts.isActive,
        userName: users.name,
        userRole: users.role,
      })
      .from(shifts)
      .leftJoin(users, eq(shifts.userId, users.id))
      .where(
        userId
          ? and(eq(shifts.eventId, eventId), eq(shifts.userId, parseInt(userId)))
          : eq(shifts.eventId, eventId)
      )
      .orderBy(users.name);

    return NextResponse.json({ shifts: rows });
  } catch (err) {
    logger.error("shifts_get_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canManageWorkforce(role)) return NextResponse.json({ error: "Forbidden — Regional Admin+ required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { userId, shiftName, timezone, startTime, endTime, days, eventId = "bharat_buildcon_2026" } = body;

  if (!userId || !startTime || !endTime) {
    return NextResponse.json({ error: "userId, startTime, endTime are required" }, { status: 400 });
  }

  try {
    const [shift] = await db
      .insert(shifts)
      .values({ eventId, userId, shiftName: shiftName ?? "Default Shift", timezone: timezone ?? "Asia/Kolkata", startTime, endTime, days: days ? JSON.stringify(days) : null, isActive: true })
      .returning({ id: shifts.id });

    logger.info("shift_created", { userId: session.user.id, entityId: shift.id, message: `Shift for user ${userId}` });
    return NextResponse.json({ ok: true, shiftId: shift.id });
  } catch (err) {
    logger.error("shift_create_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canManageWorkforce(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db.update(shifts).set({ ...updates, updatedAt: new Date() }).where(eq(shifts.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("shift_update_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canManageWorkforce(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db.update(shifts).set({ isActive: false, updatedAt: new Date() }).where(eq(shifts.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("shift_delete_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
