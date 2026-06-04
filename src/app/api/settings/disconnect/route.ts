import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/settings/disconnect
 * Wipes all GAS / Google integration fields from app_settings.
 * Leaves user accounts and registration data untouched.
 * Admin only.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role ?? "staff";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });

  try {
    await db.execute(sql`
      UPDATE app_settings SET
        gas_web_app_url           = NULL,
        registration_sheet_id     = NULL,
        drive_folder_id           = NULL,
        backup_gas_web_app_url    = NULL,
        backup_sheet_id           = NULL,
        backup_folder_id          = NULL,
        backup_sheet_id_2         = NULL,
        backup_folder_id_2        = NULL,
        dashboard_pivot_sheet_name = NULL,
        updated_at                = NOW()
      WHERE id = 1
    `);

    console.log("[POST /api/settings/disconnect] GAS integration wiped by admin");
    return NextResponse.json({
      ok: true,
      message: "Google integration disconnected. All GAS and Drive settings have been cleared.",
    });
  } catch (err: unknown) {
    console.error("[POST /api/settings/disconnect]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
