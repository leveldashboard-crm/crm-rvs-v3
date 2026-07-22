// ─── /api/v1/reports — BI Report Generation ──────────────────────────────────
// Phase 11: Reporting & Business Intelligence

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { registrations, travelRecords, kpiSnapshots, callLogs, users } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { normalizeRole, canViewReports } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canViewReports(role)) return NextResponse.json({ error: "Forbidden — Analyst+ required for reports" }, { status: 403 });

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "bharat_buildcon_2026";
  const startDate = url.searchParams.get("startDate");
  const endDate   = url.searchParams.get("endDate");
  const country   = url.searchParams.get("country");
  const continent = url.searchParams.get("continent");
  const callerId  = url.searchParams.get("callerId");
  const reportType = url.searchParams.get("type") ?? "funnel";

  try {
    if (reportType === "funnel") {
      // Delegate funnel: Cold → Warm → Hot → Registered conversion
      const conditions = [eq(registrations.eventId, eventId)];
      if (country) conditions.push(eq(registrations.countryName, country));
      if (continent) conditions.push(eq(registrations.region, continent));
      if (startDate) conditions.push(gte(registrations.createdAt, new Date(startDate)));
      if (endDate)   conditions.push(lte(registrations.createdAt, new Date(endDate)));

      const funnelData = await db
        .select({
          leadTemperature: registrations.leadTemperature,
          status: registrations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(registrations)
        .where(and(...conditions))
        .groupBy(registrations.leadTemperature, registrations.status)
        .orderBy(sql`count(*) DESC`);

      return NextResponse.json({ reportType, funnelData, eventId });
    }

    if (reportType === "performer") {
      // Top/bottom performers by KPI score
      const today = new Date().toISOString().slice(0, 10);
      const performers = await db
        .select({
          userId: kpiSnapshots.userId,
          userName: users.name,
          userRole: users.role,
          performanceScore: kpiSnapshots.performanceScore,
          totalContacted: kpiSnapshots.totalContacted,
          totalConverted: kpiSnapshots.totalConverted,
          followUpsMissed: kpiSnapshots.followUpsMissed,
          avgQaScore: kpiSnapshots.avgQaScore,
          rank: kpiSnapshots.rank,
        })
        .from(kpiSnapshots)
        .leftJoin(users, eq(kpiSnapshots.userId, users.id))
        .where(
          and(
            eq(kpiSnapshots.eventId, eventId),
            eq(kpiSnapshots.snapshotDate, today),
          )
        )
        .orderBy(desc(kpiSnapshots.performanceScore))
        .limit(20);

      return NextResponse.json({ reportType, performers, eventId });
    }

    if (reportType === "country") {
      // Registration counts by country
      const conditions = [eq(registrations.eventId, eventId)];
      if (startDate) conditions.push(gte(registrations.createdAt, new Date(startDate)));
      if (endDate)   conditions.push(lte(registrations.createdAt, new Date(endDate)));

      const byCountry = await db
        .select({
          country: registrations.countryName,
          region: registrations.region,
          total: sql<number>`count(*)::int`,
          hot: sql<number>`count(*) FILTER (WHERE ${registrations.leadTemperature} = 'Hot')::int`,
          warm: sql<number>`count(*) FILTER (WHERE ${registrations.leadTemperature} = 'Warm')::int`,
          cold: sql<number>`count(*) FILTER (WHERE ${registrations.leadTemperature} = 'Cold')::int`,
        })
        .from(registrations)
        .where(and(...conditions))
        .groupBy(registrations.countryName, registrations.region)
        .orderBy(sql`count(*) DESC`)
        .limit(100);

      return NextResponse.json({ reportType, byCountry, eventId });
    }

    if (reportType === "missed_followups") {
      const missed = await db
        .select({
          callLogId: callLogs.id,
          callerId: callLogs.callerId,
          callerName: users.name,
          followUpDue: callLogs.followUpDue,
          escalationLevel: callLogs.escalationLevel,
          registrationId: callLogs.registrationId,
        })
        .from(callLogs)
        .leftJoin(users, eq(callLogs.callerId, users.id))
        .where(
          and(
            eq(callLogs.followUpCompleted, false),
            sql`${callLogs.followUpDue} < NOW()`,
            sql`${callLogs.followUpDue} IS NOT NULL`,
          )
        )
        .orderBy(sql`${callLogs.followUpDue} ASC`)
        .limit(100);

      return NextResponse.json({ reportType, missed, eventId });
    }

    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  } catch (err) {
    logger.error("reports_get_failed", err, { userId: session.user.id });
    return NextResponse.json({
      reportType,
      funnelData: [],
      performers: [],
      byCountry: [],
      missed: [],
      eventId,
    });
  }
}
