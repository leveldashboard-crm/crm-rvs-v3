// ─── /api/v1/kpi — KPI Snapshots ─────────────────────────────────────────────
// Phase 3: KPI Engine + Master Admin Command Center

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { kpiSnapshots, users, callLogs, registrations } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { normalizeRole, canViewDashboard } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/v1/kpi — fetch KPI data
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  if (!canViewDashboard(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const eventId = url.searchParams.get("eventId") ?? "bharat_buildcon_2026";

  try {
    // Get today's snapshot for all callers
    const snapshots = await db
      .select({
        userId: kpiSnapshots.userId,
        snapshotDate: kpiSnapshots.snapshotDate,
        totalAssigned: kpiSnapshots.totalAssigned,
        totalContacted: kpiSnapshots.totalContacted,
        totalConverted: kpiSnapshots.totalConverted,
        followUpsMissed: kpiSnapshots.followUpsMissed,
        followUpsCompleted: kpiSnapshots.followUpsCompleted,
        avgQaScore: kpiSnapshots.avgQaScore,
        performanceScore: kpiSnapshots.performanceScore,
        rank: kpiSnapshots.rank,
        userName: users.name,
        userRole: users.role,
        userPresence: users.presenceStatus,
        userLastSeen: users.lastSeenAt,
      })
      .from(kpiSnapshots)
      .leftJoin(users, eq(kpiSnapshots.userId, users.id))
      .where(
        and(
          eq(kpiSnapshots.snapshotDate, date),
          eq(kpiSnapshots.eventId, eventId),
        )
      )
      .orderBy(desc(kpiSnapshots.performanceScore))
      .limit(50);

    // Live caller activity (presence data for master admin command center)
    const activeCallers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        presenceStatus: users.presenceStatus,
        lastSeenAt: users.lastSeenAt,
        region: users.region,
        continent: users.continent,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name)
      .limit(100);

    // Org-wide aggregates from registrations (fast counts)
    const totalRegistrations = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .where(eq(registrations.eventId, eventId));

    const today = new Date().toISOString().slice(0, 10);
    const followUpsDueToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(
        and(
          eq(callLogs.followUpCompleted, false),
          sql`DATE(${callLogs.followUpDue}) = ${today}::date`,
        )
      );

    const missedFollowUps = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(
        and(
          eq(callLogs.followUpCompleted, false),
          sql`${callLogs.followUpDue} < NOW()`,
          sql`${callLogs.followUpDue} IS NOT NULL`,
        )
      );

    logger.info("kpi_fetch", { userId: session.user.id, userRole: role });

    return NextResponse.json({
      snapshots,
      activeCallers,
      totals: {
        registrations: totalRegistrations[0]?.count ?? 0,
        followUpsDueToday: followUpsDueToday[0]?.count ?? 0,
        missedFollowUps: missedFollowUps[0]?.count ?? 0,
      },
      date,
      eventId,
    });
  } catch (err) {
    logger.error("kpi_fetch_failed", err, { userId: session.user.id });
    return NextResponse.json({
      snapshots: [],
      activeCallers: [],
      totals: {
        registrations: 0,
        followUpsDueToday: 0,
        missedFollowUps: 0,
      },
      date,
      eventId,
    });
  }
}

// POST /api/v1/kpi — write a KPI snapshot (called by cron or admin action)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  if (!canViewDashboard(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    userId, snapshotDate, totalAssigned, totalContacted, totalConverted,
    followUpsMissed, followUpsCompleted, avgQaScore, performanceScore, rank,
    eventId = "bharat_buildcon_2026",
  } = body;

  if (!userId || !snapshotDate) {
    return NextResponse.json({ error: "userId and snapshotDate are required" }, { status: 400 });
  }

  try {
    await db
      .insert(kpiSnapshots)
      .values({
        eventId, userId, snapshotDate,
        totalAssigned: totalAssigned ?? 0,
        totalContacted: totalContacted ?? 0,
        totalConverted: totalConverted ?? 0,
        followUpsMissed: followUpsMissed ?? 0,
        followUpsCompleted: followUpsCompleted ?? 0,
        avgQaScore: avgQaScore ?? null,
        performanceScore: performanceScore ?? null,
        rank: rank ?? null,
      })
      .onConflictDoUpdate({
        target: [kpiSnapshots.userId, kpiSnapshots.snapshotDate],
        set: {
          totalAssigned, totalContacted, totalConverted,
          followUpsMissed, followUpsCompleted, avgQaScore, performanceScore, rank,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("kpi_write_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
