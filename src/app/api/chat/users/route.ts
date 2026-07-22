import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        sector: users.sector,
      })
      .from(users)
      .orderBy(asc(users.name));

    const currentEmail = session.user?.email;
    const currentUser = currentEmail ? allUsers.find((u) => u.email === currentEmail) : null;

    return NextResponse.json({
      users: allUsers,
      currentUserId: currentUser?.id ?? 1,
    });
  } catch (err) {
    console.error("[GET /api/chat/users]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
