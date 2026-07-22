import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailLogs, registrations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";

// ─── POST /api/v1/mailer/compose ──────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { leadId, recipientEmail, ccList, subject, body: emailBody, templateUsed } = body as {
      leadId?: number;
      recipientEmail: string;
      ccList?: string[];
      subject: string;
      body: string;
      templateUsed?: string;
    };

    if (!recipientEmail || !subject || !emailBody) {
      return NextResponse.json({ error: "recipientEmail, subject, and body are required" }, { status: 400 });
    }

    const userName = session.user?.name ?? session.user?.email ?? "User";
    const userId = session.user?.id ? parseInt(session.user.id) : null;

    // 1. Save to email_logs table
    const [insertedLog] = await db
      .insert(emailLogs)
      .values({
        leadId: leadId ?? null,
        sentById: userId,
        sentByName: userName,
        recipientEmail: recipientEmail.trim(),
        ccList: Array.isArray(ccList) ? ccList : [],
        subject: subject.trim(),
        body: emailBody.trim(),
        templateUsed: templateUsed ?? null,
        status: "sent",
      })
      .returning();

    // 2. If associated with a lead, update lead emailComments & emailRequestStatus
    if (leadId) {
      const [lead] = await db
        .select()
        .from(registrations)
        .where(eq(registrations.id, leadId))
        .limit(1);

      if (lead) {
        const timestamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const newEmailNote = `[${timestamp} by ${userName}] Subject: "${subject}"`;
        const existingComments = lead.emailComments ? `${lead.emailComments}\n${newEmailNote}` : newEmailNote;

        await db
          .update(registrations)
          .set({
            emailComments: existingComments,
            emailRequestStatus: "sent",
            updatedAt: new Date(),
          })
          .where(eq(registrations.id, leadId));
      }
    }

    // 3. Write Audit Log
    writeAuditLog({
      userId: userId ?? 0,
      userName,
      action: "send_lead_email",
      entityType: "email_log",
      entityId: insertedLog.id,
      metadata: { recipientEmail, subject, leadId, templateUsed },
    }).catch(console.error);

    return NextResponse.json({ ok: true, emailLog: insertedLog });
  } catch (err: unknown) {
    console.error("[POST /api/v1/mailer/compose]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
