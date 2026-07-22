// ─── /api/v1/allocation — Task Batch CRUD ────────────────────────────────────
// Phase 2: Task Allocation (eventId-scoped, TTL locks)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taskBatches, registrations, users } from "@/db/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import { normalizeRole, canAllocate, canViewAllocation } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const LOCK_TTL_MINUTES = 15;

// GET /api/v1/allocation — list batches
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canViewAllocation(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") ?? "bharat_buildcon_2026";
  const userId = parseInt(session.user.id);

  try {
    // Callers only see their own batches; team leads+ see all
    const batches = await db
      .select({
        id: taskBatches.id,
        sector: taskBatches.sector,
        name: taskBatches.name,
        assignedToId: taskBatches.assignedToId,
        assignedToName: taskBatches.assignedToName,
        country: taskBatches.country,
        continent: taskBatches.continent,
        timeLink: taskBatches.timeLink,
        status: taskBatches.status,
        completionPercent: taskBatches.completionPercent,
        totalDelegates: taskBatches.totalDelegates,
        completedDelegates: taskBatches.completedDelegates,
        lockedBy: taskBatches.lockedBy,
        lockedAt: taskBatches.lockedAt,
        lockExpiresAt: taskBatches.lockExpiresAt,
        dueAt: taskBatches.dueAt,
        notes: taskBatches.notes,
        createdAt: taskBatches.createdAt,
        updatedAt: taskBatches.updatedAt,
      })
      .from(taskBatches)

      .where(
        role === "caller"
          ? and(eq(taskBatches.eventId, eventId), eq(taskBatches.assignedToId, userId))
          : eq(taskBatches.eventId, eventId)
      )
      .orderBy(sql`${taskBatches.createdAt} DESC`)
      .limit(100);

    return NextResponse.json({ batches });
  } catch (err) {
    logger.error("allocation_get_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/v1/allocation — create batch
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole(session.user.role);
  if (!canAllocate(role)) return NextResponse.json({ error: "Forbidden — only Team Lead+ can allocate" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    name,
    assignedToId,
    assignedToIds,
    country,
    continent,
    sector = "Bharat Buildcon",
    timeLink,
    delegateIds,
    dueAt,
    deadline,
    notes,
    phases: customPhases,
    eventId = "bharat_buildcon_2026"
  } = body;

  if (!name || (!assignedToId && (!assignedToIds || assignedToIds.length === 0))) {
    return NextResponse.json({ error: "name and assignedToId are required" }, { status: 400 });
  }

  const primaryAssigneeId = assignedToId ? parseInt(String(assignedToId)) : parseInt(String(assignedToIds[0]));
  const targetDue = dueAt || deadline;

  try {
    const [assignedUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, primaryAssigneeId))
      .limit(1);

    const [batch] = await db
      .insert(taskBatches)
      .values({
        eventId,
        sector,
        name,
        assignedToId: primaryAssigneeId,
        assignedToIds: assignedToIds ?? [primaryAssigneeId],
        assignedToName: assignedUser?.name ?? "Unknown",
        createdById: parseInt(session.user.id),
        country: country ?? null,
        continent: continent ?? null,
        timeLink: timeLink ?? null,
        status: "pending",
        completionPercent: 0,
        totalDelegates: Array.isArray(delegateIds) ? delegateIds.length : 0,
        completedDelegates: 0,
        dueAt: targetDue ? new Date(targetDue) : null,
        notes: notes ?? null,
      })
      .returning({ id: taskBatches.id });

    // Initialize Default Task Phases (Data Collection → Initial Calling → Follow-up → Registration Closure)
    const initialPhases = Array.isArray(customPhases) && customPhases.length > 0
      ? customPhases
      : ["Data Collection", "Initial Calling", "Follow-up", "Registration Closure"];

    const userName = session.user.name ?? session.user.email ?? "User";
    const userId = parseInt(session.user.id);

    for (let idx = 0; idx < initialPhases.length; idx++) {
      const phaseName = typeof initialPhases[idx] === "string" ? initialPhases[idx] : initialPhases[idx].name;
      const taskPhasesTable = (await import("@/db/schema")).taskPhases;
      await db.insert(taskPhasesTable).values({
        taskId: batch.id,
        name: phaseName,
        status: "not_started",
        sortOrder: idx + 1,
        updatedById: userId,
        updatedByName: userName,
      });
    }

    // If delegate IDs provided, assign them
    if (Array.isArray(delegateIds) && delegateIds.length > 0) {
      for (const delegateId of delegateIds) {
        await db
          .update(registrations)
          .set({ assignedCallerId: primaryAssigneeId, assignedAt: new Date(), updatedAt: new Date() })
          .where(eq(registrations.id, delegateId));
      }
    }

    // Notify the assigned caller
    await createNotification({
      eventId,
      targetUserId: primaryAssigneeId,
      sourceUserId: parseInt(session.user.id),
      type: "allocation_assigned",
      title: `New Task Batch Assigned: ${name}`,
      message: `Sector: ${sector} · ${delegateIds?.length ?? 0} delegate(s). ${targetDue ? `Due: ${new Date(targetDue).toLocaleDateString()}` : ""}`,
      payload: { batchId: batch.id, totalDelegates: delegateIds?.length ?? 0 },
      priority: "normal",
    });

    await writeAuditLog({
      userId: parseInt(session.user.id),
      userName: session.user.name ?? session.user.email ?? "Unknown",
      userRole: role,
      action: "allocation_batch_created",
      entityType: "task_batch",
      entityId: batch.id,
      metadata: { name, sector, assignedToId: primaryAssigneeId, delegateCount: delegateIds?.length ?? 0 },
    });

    logger.info("allocation_batch_created", { userId: session.user.id, entityId: batch.id, message: name });

    return NextResponse.json({ ok: true, batchId: batch.id });
  } catch (err) {
    logger.error("allocation_create_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}


// PATCH /api/v1/allocation — acquire/release lock, update status
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { batchId, action, status } = body;
  // action: "lock" | "release" | "status_update"

  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const userId = parseInt(session.user.id);
  const now = new Date();

  try {
    if (action === "lock") {
      // Expire stale locks first
      await db
        .update(taskBatches)
        .set({ lockedBy: null, lockedAt: null, lockExpiresAt: null })
        .where(lt(taskBatches.lockExpiresAt, now));

      const lockExpiry = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
      await db
        .update(taskBatches)
        .set({ lockedBy: userId, lockedAt: now, lockExpiresAt: lockExpiry, updatedAt: now })
        .where(and(eq(taskBatches.id, batchId), sql`${taskBatches.lockedBy} IS NULL`));

      return NextResponse.json({ ok: true, lockedUntil: lockExpiry });
    }

    if (action === "release") {
      await db
        .update(taskBatches)
        .set({ lockedBy: null, lockedAt: null, lockExpiresAt: null, updatedAt: now })
        .where(and(eq(taskBatches.id, batchId), eq(taskBatches.lockedBy, userId)));

      return NextResponse.json({ ok: true });
    }

    if (action === "status_update" && status) {
      await db
        .update(taskBatches)
        .set({
          status,
          completedAt: status === "completed" ? now : null,
          updatedAt: now,
        })
        .where(eq(taskBatches.id, batchId));

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    logger.error("allocation_patch_failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
