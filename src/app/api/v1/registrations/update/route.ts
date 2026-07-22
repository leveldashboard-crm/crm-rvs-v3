import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { registrations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { mockRegistrationsStore } from "@/lib/mock-db";
import { normalizeRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

let _columnsChecked = false;
async function ensureCallerColumns() {
  if (_columnsChecked) return;
  try {
    // Dynamic schema expansion so local postgres upgrades without failing
    await db.execute(sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS caller_comment TEXT`);
    await db.execute(sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS caller_remark TEXT`);
    await db.execute(sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS email_request_status TEXT DEFAULT 'none'`);
    await db.execute(sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ`);
    _columnsChecked = true;
  } catch (err) {
    console.error("[ensureCallerColumns] failed to alter table:", err);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registrationId, callerComment, callerRemark, emailRequestStatus, followUpDate } = body as {
    registrationId: number;
    callerComment?: string | null;
    callerRemark?: string | null;
    emailRequestStatus?: string | null;
    followUpDate?: string | null;
  };

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
  }

  try {
    await ensureCallerColumns();

    // Load existing registration row
    const [row] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, registrationId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const role = normalizeRole(session.user.role);
    const userId = session.user.id === "admin" ? 1 : parseInt(session.user.id || "0");
    const isCaller = role === "caller";

    // Build patch values
    const updatePayload: Record<string, unknown> = {};

    if (callerComment !== undefined) {
      // 4 Strict comments check
      const validComments = [
        "Interested - Send Details",
        "Busy - Call Back Later",
        "Not Interested",
        "Wrong Number / Invalid Details"
      ];
      if (callerComment && !validComments.includes(callerComment)) {
        return NextResponse.json({ error: "Invalid comment value" }, { status: 400 });
      }
      updatePayload.callerComment = callerComment;
    }

    if (callerRemark !== undefined) {
      updatePayload.callerRemark = callerRemark;
    }

    if (followUpDate !== undefined) {
      updatePayload.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }

    if (emailRequestStatus !== undefined) {
      // Access check: only admins/supervisors/team_leads can set emailRequestStatus to 'sent'
      if (emailRequestStatus === "sent") {
        if (role !== "master_admin" && role !== "regional_admin" && role !== "team_lead") {
          return NextResponse.json({ error: "Forbidden: Only supervisors/admins can approve email requests" }, { status: 403 });
        }
      }
      // Callers can set emailRequestStatus to 'pending' or 'none'
      if (isCaller && emailRequestStatus !== "pending" && emailRequestStatus !== "none" && emailRequestStatus !== null) {
        return NextResponse.json({ error: "Forbidden: Callers can only request emails" }, { status: 403 });
      }

      updatePayload.emailRequestStatus = emailRequestStatus || "none";
    }

    // Execute update
    const [updatedRow] = await db
      .update(registrations)
      .set({
        ...updatePayload,
        updatedAt: new Date()
      })
      .where(eq(registrations.id, registrationId))
      .returning();

    // Write audit log
    await writeAuditLog({
      userId,
      userName: session.user.name ?? "User",
      userRole: role,
      action: "update_caller_lead_fields",
      entityType: "registration",
      entityId: registrationId,
      metadata: { fields: Object.keys(updatePayload) }
    }).catch(console.error);

    return NextResponse.json({ ok: true, record: updatedRow });
  } catch (err) {
    console.warn("[PATCH /api/v1/registrations/update] Database update failed, falling back to mock registrations store:", err);
    const updated = mockRegistrationsStore.update(Number(registrationId), {
      callerComment,
      callerRemark,
      emailRequestStatus,
      followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
    });
    if (updated) {
      return NextResponse.json({
        ok: true,
        record: {
          id: updated.id,
          srNo: updated.sr_no,
          firstName: updated.first_name,
          lastName: updated.last_name,
          countryName: updated.country_name,
          companyName: updated.company_name,
          mainImportProduct1: updated.main_import_product_1,
          poc: updated.poc,
          assignedCallerId: updated.assigned_caller_id,
          callerComment: updated.caller_comment,
          callerRemark: updated.caller_remark,
          emailRequestStatus: updated.email_request_status,
          followUpDate: updated.follow_up_date,
        }
      });
    }

    logger.error("registration_caller_patch_failed", err, { userId: session?.user?.id });
    return NextResponse.json({ error: "Internal database error" }, { status: 500 });
  }
}

