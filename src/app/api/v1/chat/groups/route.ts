import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { chatGroups, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// ─── GET /api/v1/chat/groups ──────────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const groups = await db
      .select()
      .from(chatGroups)
      .orderBy(asc(chatGroups.name));

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[GET /api/v1/chat/groups]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/chat/groups ─────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, description, memberIds } = body as {
      name: string;
      description?: string;
      memberIds?: number[];
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const createdByName = session.user?.name ?? session.user?.email ?? "User";
    const createdById = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(chatGroups)
      .values({
        name: name.trim(),
        description: description?.trim() ?? null,
        createdById: isNaN(Number(createdById)) ? null : createdById,
        createdByName,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      })
      .returning();

    return NextResponse.json({ ok: true, group: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/chat/groups]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
