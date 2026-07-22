import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { roster, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { canManageRoster, normalizeRole } from "@/lib/rbac";

// ─── GET /api/v1/roster ───────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const week = url.searchParams.get("week") ?? "2026-W30";

  try {
    const entries = await db
      .select({
        id: roster.id,
        week: roster.week,
        userId: roster.userId,
        userName: roster.userName,
        sector: roster.sector,
        country: roster.country,
        createdAt: roster.createdAt,
      })
      .from(roster)
      .where(eq(roster.week, week))
      .orderBy(asc(roster.sector), asc(roster.country));

    return NextResponse.json({ roster: entries });
  } catch (err) {
    console.error("[GET /api/v1/roster]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/roster ──────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  if (!canManageRoster(role)) {
    return NextResponse.json({ error: "Forbidden — Regional Admin+ required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { week = "2026-W30", userId, sector, country } = body as {
      week?: string;
      userId: number;
      sector: string;
      country: string;
    };

    if (!userId || !sector || !country) {
      return NextResponse.json({ error: "userId, sector, and country are required" }, { status: 400 });
    }

    const [userRecord] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const createdById = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(roster)
      .values({
        week,
        userId,
        userName: userRecord?.name ?? "Unknown",
        sector,
        country,
        createdById,
      })
      .returning();

    return NextResponse.json({ ok: true, entry: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/roster]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
