import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taskPhases, taskBatches } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// ─── GET /api/v1/tasks/[id]/phases ───────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  try {
    const phases = await db
      .select()
      .from(taskPhases)
      .where(eq(taskPhases.taskId, taskId))
      .orderBy(asc(taskPhases.sortOrder), asc(taskPhases.id));

    return NextResponse.json({ phases });
  } catch (err) {
    console.error("[GET /api/v1/tasks/[id]/phases]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/tasks/[id]/phases ──────────────────────────────────────────
// Add a custom phase to a task
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  try {
    const body = await request.json();
    const { name, sortOrder } = body as { name: string; sortOrder?: number };
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Phase name required" }, { status: 400 });
    }

    const userName = session.user?.name ?? session.user?.email ?? "User";
    const userId = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(taskPhases)
      .values({
        taskId,
        name: name.trim(),
        status: "not_started",
        updatedById: userId,
        updatedByName: userName,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    // Recalculate task completion percent
    await recalculateCompletion(taskId);

    return NextResponse.json({ ok: true, phase: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/tasks/[id]/phases]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH /api/v1/tasks/[id]/phases ─────────────────────────────────────────
// Update status of a phase
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  try {
    const body = await request.json();
    const { phaseId, status } = body as { phaseId: number; status: "not_started" | "in_progress" | "done" };

    if (!phaseId || !status) {
      return NextResponse.json({ error: "phaseId and status required" }, { status: 400 });
    }

    const userName = session.user?.name ?? session.user?.email ?? "User";
    const userId = session.user?.id ? parseInt(session.user.id) : null;

    const [updated] = await db
      .update(taskPhases)
      .set({
        status,
        updatedById: userId,
        updatedByName: userName,
        updatedAt: new Date(),
      })
      .where(eq(taskPhases.id, phaseId))
      .returning();

    // Recalculate task completion percent
    const newPercent = await recalculateCompletion(taskId);

    return NextResponse.json({ ok: true, phase: updated, completionPercent: newPercent });
  } catch (err: unknown) {
    console.error("[PATCH /api/v1/tasks/[id]/phases]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Helper function to recalculate task completion percent
async function recalculateCompletion(taskId: number): Promise<number> {
  const allPhases = await db
    .select()
    .from(taskPhases)
    .where(eq(taskPhases.taskId, taskId));

  if (allPhases.length === 0) return 0;

  const doneCount = allPhases.filter((p) => p.status === "done").length;
  const percent = Math.round((doneCount / allPhases.length) * 100);

  const taskStatus = percent === 100 ? "completed" : percent > 0 ? "in_progress" : "pending";

  await db
    .update(taskBatches)
    .set({
      completionPercent: percent,
      status: taskStatus,
      completedAt: percent === 100 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(taskBatches.id, taskId));

  return percent;
}
