// ─── POST /api/v1/presence — Heartbeat endpoint ───────────────────────────────
// Updates caller's lastSeenAt and presenceStatus. Also triggers escalation check.
// Phase 4: Workforce & Shift Management

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runEscalationCheck } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const body = await req.json().catch(() => ({}));
  const status = (body.status ?? "online") as "online" | "idle" | "on_break";

  try {
    await db
      .update(users)
      .set({ lastSeenAt: new Date(), presenceStatus: status, updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info("presence_heartbeat", {
      userId,
      userRole: session.user.role,
      message: `status=${status}`,
    });

    // Run escalation check on every heartbeat (lightweight — skips if nothing is overdue)
    const { escalated } = await runEscalationCheck();

    return NextResponse.json({ ok: true, status, escalated });
  } catch (err) {
    logger.error("presence_heartbeat_failed", err, { userId });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return current user presence status
  const userId = parseInt(session.user.id);
  try {
    const [user] = await db
      .select({ presenceStatus: users.presenceStatus, lastSeenAt: users.lastSeenAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({ status: user?.presenceStatus ?? "offline", lastSeenAt: user?.lastSeenAt });
  } catch {
    return NextResponse.json({ status: "offline", lastSeenAt: null });
  }
}
