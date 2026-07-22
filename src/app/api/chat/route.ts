import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { chatMessages, users } from "@/db/schema";
import { asc, eq, or, and, isNull } from "drizzle-orm";

// Helper to resolve numeric user ID from session
async function resolveUserId(sessionUser: { id?: string; email?: string | null }): Promise<number> {
  const email = sessionUser.email;
  if (email) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (dbUser) return dbUser.id;
  }

  if (sessionUser.id) {
    const num = parseInt(sessionUser.id, 10);
    if (!isNaN(num)) return num;
  }

  return 1; // Default fallback to admin (ID 1)
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const recipientIdParam = url.searchParams.get("recipientId");

  try {
    const currentUserId = await resolveUserId(session.user);

    let query = db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        userId: chatMessages.userId,
        recipientId: chatMessages.recipientId,
        fileUrl: chatMessages.fileUrl,
        fileName: chatMessages.fileName,
        isEdited: chatMessages.isEdited,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id));

    if (recipientIdParam) {
      const rId = parseInt(recipientIdParam, 10);
      if (!isNaN(rId)) {
        query = query.where(
          or(
            and(eq(chatMessages.userId, currentUserId), eq(chatMessages.recipientId, rId)),
            and(eq(chatMessages.userId, rId), eq(chatMessages.recipientId, currentUserId))
          )
        ) as typeof query;
      }
    } else {
      // Team chat (recipient_id IS NULL)
      query = query.where(isNull(chatMessages.recipientId)) as typeof query;
    }

    const rawMessages = await query.orderBy(asc(chatMessages.createdAt)).limit(500);

    const messages = rawMessages.map((m) => ({
      ...m,
      userName: m.userName || m.userEmail || (m.userId === currentUserId ? session.user?.name ?? "You" : "Team Member"),
      userEmail: m.userEmail || "",
      userRole: m.userRole || "caller",
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[GET /api/chat]", err);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { message, recipientId, fileUrl, fileName } = body as {
      message?: string;
      recipientId?: string | number | null;
      fileUrl?: string | null;
      fileName?: string | null;
    };

    if (!message && !fileUrl) {
      return NextResponse.json({ error: "Message or file is required" }, { status: 400 });
    }

    const currentUserId = await resolveUserId(session.user);

    let parsedRecipientId: number | null = null;
    if (recipientId != null) {
      const parsed = parseInt(String(recipientId), 10);
      if (!isNaN(parsed)) parsedRecipientId = parsed;
    }

    const [inserted] = await db
      .insert(chatMessages)
      .values({
        userId: currentUserId,
        recipientId: parsedRecipientId,
        message: message ? message.trim() : "",
        fileUrl: fileUrl || null,
        fileName: fileName || null,
      })
      .returning();

    return NextResponse.json({ ok: true, message: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/chat]", err);
    const msg = err instanceof Error ? err.message : "Database insert failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
