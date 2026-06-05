import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { sql, desc, ilike, or } from "drizzle-orm";

// ─── GET /api/operation-log ───────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role ?? "staff";
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "200"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const filter = url.searchParams.get("filter") ?? "";

  try {
    // Build query with optional filter
    const baseQuery = db
      .select({
        id:          auditLog.id,
        userId:      auditLog.userId,
        userName:    auditLog.userName,
        userRole:    auditLog.userRole,
        action:      auditLog.action,
        entityType:  auditLog.entityType,
        entityId:    auditLog.entityId,
        status:      auditLog.status,
        ipAddress:   auditLog.ipAddress,
        metadata:    auditLog.metadata,
        createdAt:   auditLog.createdAt,
      })
      .from(auditLog);

    const rows = filter
      ? await baseQuery
          .where(
            or(
              ilike(auditLog.action,     `%${filter}%`),
              ilike(auditLog.entityType, `%${filter}%`),
              ilike(auditLog.userName,   `%${filter}%`)
            )
          )
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
          .offset(offset)
      : await baseQuery
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
          .offset(offset);

    const [countRow] = filter
      ? await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(auditLog)
          .where(
            or(
              ilike(auditLog.action,     `%${filter}%`),
              ilike(auditLog.entityType, `%${filter}%`),
              ilike(auditLog.userName,   `%${filter}%`)
            )
          )
      : await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(auditLog);

    return NextResponse.json({ logs: rows, total: Number(countRow?.count ?? 0) });
  } catch (err) {
    console.error("[GET /api/operation-log]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── DELETE /api/operation-log?id=N  — admin marks a log entry as blocked ────
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role ?? "staff";
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const url = new URL(request.url);
  const id  = parseInt(url.searchParams.get("id") ?? "");
  if (isNaN(id)) return NextResponse.json({ error: "Invalid log ID" }, { status: 400 });

  try {
    await db.execute(sql`
      UPDATE audit_log SET status = 'blocked' WHERE id = ${id}
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/operation-log]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
