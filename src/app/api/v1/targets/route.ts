import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { targets, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { canManageAllUsers, normalizeRole } from "@/lib/rbac";

// ─── GET /api/v1/targets ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ? parseInt(url.searchParams.get("userId")!) : undefined;

  try {
    const list = await db
      .select({
        id: targets.id,
        userId: targets.userId,
        userName: targets.userName,
        sector: targets.sector,
        targetType: targets.targetType,
        taskCategory: targets.taskCategory,
        period: targets.period,
        goal: targets.goal,
        currentAttainment: targets.currentAttainment,
        createdAt: targets.createdAt,
        updatedAt: targets.updatedAt,
      })
      .from(targets)
      .where(userId ? eq(targets.userId, userId) : undefined)
      .orderBy(asc(targets.period));

    return NextResponse.json({ targets: list });
  } catch (err) {
    console.error("[GET /api/v1/targets]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/targets ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  if (!canManageAllUsers(role)) {
    return NextResponse.json({ error: "Forbidden — Admin required to set targets" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, period, goal, sector, currentAttainment, targetType, taskCategory } = body as {
      userId?: number;
      period: "3m" | "6m" | "9m";
      goal: number;
      sector?: string;
      currentAttainment?: number;
      targetType?: "individual" | "team";
      taskCategory?: string;
    };

    if (!period || goal == null) {
      return NextResponse.json({ error: "period and goal are required" }, { status: 400 });
    }

    let userName = "Team Target";
    if (userId) {
      const [userRecord] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      userName = userRecord?.name ?? "Unknown";
    }

    const createdById = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(targets)
      .values({
        userId: userId ?? null,
        userName,
        sector: sector ?? null,
        targetType: targetType ?? (userId ? "individual" : "team"),
        taskCategory: taskCategory ?? "Overseas Calling",
        period,
        goal,
        currentAttainment: currentAttainment ?? 0,
        createdById,
      })
      .returning();

    return NextResponse.json({ ok: true, target: inserted });

  } catch (err: unknown) {
    console.error("[POST /api/v1/targets]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
