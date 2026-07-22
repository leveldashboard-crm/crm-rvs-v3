// ─── /api/v1/qa — QA Scorecard CRUD ─────────────────────────────────────────
// Phase 5: QA Scorecard
// RBAC: only qa_auditor and master_admin can submit scores

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { qaScores, users } from "@/db/schema";
import { eq, and, desc, sql, avg } from "drizzle-orm";
import { normalizeRole, canSubmitQAScore, canViewQA } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canViewQA(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const callerId = url.searchParams.get("callerId");
  const eventId = url.searchParams.get("eventId") ?? "bharat_buildcon_2026";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);

  try {
    const conditions = [eq(qaScores.eventId, eventId)];
    if (callerId) conditions.push(eq(qaScores.callerId, parseInt(callerId)));

    const scores = await db
      .select({
        id: qaScores.id,
        callLogId: qaScores.callLogId,
        auditorName: qaScores.auditorName,
        callerId: qaScores.callerId,
        callerName: qaScores.callerName,
        scriptAdherence: qaScores.scriptAdherence,
        tone: qaScores.tone,
        dataAccuracy: qaScores.dataAccuracy,
        customerHandling: qaScores.customerHandling,
        overallScore: qaScores.overallScore,
        notes: qaScores.notes,
        scoredAt: qaScores.scoredAt,
      })
      .from(qaScores)
      .where(and(...conditions))
      .orderBy(desc(qaScores.scoredAt))
      .limit(limit);

    // Weekly summary per caller
    const weeklySummary = await db
      .select({
        callerId: qaScores.callerId,
        callerName: qaScores.callerName,
        avgScore: sql<string>`AVG(${qaScores.overallScore})::numeric(5,2)`,
        scoreCount: sql<number>`count(*)::int`,
      })
      .from(qaScores)
      .where(
        and(
          eq(qaScores.eventId, eventId),
          sql`${qaScores.scoredAt} >= NOW() - INTERVAL '7 days'`,
        )
      )
      .groupBy(qaScores.callerId, qaScores.callerName)
      .orderBy(sql`AVG(${qaScores.overallScore}) DESC`);

    return NextResponse.json({ scores, weeklySummary });
  } catch (err) {
    logger.error("qa_get_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canSubmitQAScore(role)) {
    return NextResponse.json({ error: "Forbidden — only QA Auditors can submit scores" }, { status: 403 });
  }


  const body = await req.json().catch(() => ({}));
  const { callLogId, callerId, callerName, scriptAdherence, tone, dataAccuracy, customerHandling, notes, eventId = "bharat_buildcon_2026" } = body;

  if (!callLogId || !callerId) {
    return NextResponse.json({ error: "callLogId and callerId are required" }, { status: 400 });
  }

  // Validate rubric scores (1–5)
  const rubricFields = [scriptAdherence, tone, dataAccuracy, customerHandling];
  if (rubricFields.some(v => v !== undefined && (v < 1 || v > 5))) {
    return NextResponse.json({ error: "Rubric scores must be between 1 and 5" }, { status: 400 });
  }

  const validScores = rubricFields.filter(v => v != null);
  const overallScore = validScores.length > 0
    ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
    : null;

  try {
    const auditorUserId = parseInt(session.user.id);
    const [auditor] = await db.select({ name: users.name }).from(users).where(eq(users.id, auditorUserId)).limit(1);

    const [score] = await db.insert(qaScores).values({
      eventId, callLogId, callerId, callerName: callerName ?? null,
      auditorId: auditorUserId,
      auditorName: auditor?.name ?? session.user.email ?? "Unknown",
      scriptAdherence: scriptAdherence ?? null,
      tone: tone ?? null,
      dataAccuracy: dataAccuracy ?? null,
      customerHandling: customerHandling ?? null,
      overallScore: overallScore,
      notes: notes ?? null,
      rubricData: body.rubricData ?? null,
      scoredAt: new Date(),
    }).returning({ id: qaScores.id });

    await writeAuditLog({
      userId: auditorUserId, userName: auditor?.name ?? "Unknown", userRole: role,
      action: "qa_score_submitted", entityType: "call_log", entityId: callLogId,
      metadata: { scoreId: score.id, overallScore, callerId },
    });

    logger.info("qa_score_submitted", { userId: session.user.id, entityId: score.id, message: `Score for caller ${callerId}: ${overallScore}` });

    return NextResponse.json({ ok: true, scoreId: score.id, overallScore });
  } catch (err) {
    logger.error("qa_score_submit_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
