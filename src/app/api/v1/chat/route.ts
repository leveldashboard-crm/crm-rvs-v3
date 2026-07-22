import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { chatMessages, users } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { isComplianceRole, normalizeRole } from "@/lib/rbac";

// ─── GET /api/v1/chat ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const threadType = url.searchParams.get("threadType") ?? "task";
  const threadId = url.searchParams.get("threadId") ?? "general";

  try {
    const messages = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        userName: users.name,
        threadType: chatMessages.threadType,
        threadId: chatMessages.threadId,
        message: chatMessages.message,
        fileUrl: chatMessages.fileUrl,
        fileName: chatMessages.fileName,
        fileSize: chatMessages.fileSize,
        attachments: chatMessages.attachments,
        isEdited: chatMessages.isEdited,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(
        and(
          eq(chatMessages.threadType, threadType),
          eq(chatMessages.threadId, threadId)
        )
      )
      .orderBy(asc(chatMessages.createdAt))
      .limit(200);

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[GET /api/v1/chat]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/chat ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  // Compliance role is read-only monitoring
  if (isComplianceRole(role)) {
    return NextResponse.json({ error: "Forbidden — Tech/Compliance role is read-only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { threadType = "task", threadId = "general", message, fileUrl, fileName, fileSize, attachments } = body as {
      threadType?: string;
      threadId?: string;
      message: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: string;
      attachments?: Array<{ url: string; fileName: string; fileSize?: string }>;
    };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const userId = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(chatMessages)
      .values({
        userId,
        threadType,
        threadId: String(threadId),
        message: message.trim(),
        fileUrl: fileUrl ?? null,
        fileName: fileName ?? null,
        fileSize: fileSize ?? null,
        attachments: attachments ?? null,
      })
      .returning();

    return NextResponse.json({ ok: true, message: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/chat]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
