import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// Run once per server process — subsequent calls are a no-op
let _settingsMigrated = false;
async function ensureSettingsSchema() {
  if (_settingsMigrated) return;
  const cols = [
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS db_vujis_sheet_name TEXT DEFAULT 'DB & vujis'`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 30`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS backup_gas_web_app_url TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS backup_sheet_id TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS backup_folder_id TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS backup_sheet_id_2 TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS backup_folder_id_2 TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS dashboard_pivot_sheet_name TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_web_app_url TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_shared_secret TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_mode TEXT DEFAULT 'api'`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_enabled BOOLEAN DEFAULT false`,
  ];
  for (const stmt of cols) {
    try { await db.execute(sql.raw(stmt)); } catch { /* already exists */ }
  }
  _settingsMigrated = true;
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureSettingsSchema();

    const result = await db.execute(sql`
      SELECT
        id,
        registration_sheet_id,
        COALESCE(registration_sheet_name, 'Form Responses 1')  AS registration_sheet_name,
        COALESCE(travel_sheet_name,       'Travel Desk Records') AS travel_sheet_name,
        COALESCE(db_vujis_sheet_name,     'DB & vujis')          AS db_vujis_sheet_name,
        COALESCE(session_timeout_minutes, 30)                    AS session_timeout_minutes,
        drive_folder_id,
        gas_web_app_url,
        backup_gas_web_app_url,
        backup_sheet_id,
        backup_folder_id,
        backup_sheet_id_2,
        backup_folder_id_2,
        COALESCE(dashboard_pivot_sheet_name, '') AS dashboard_pivot_sheet_name,
        mailer_web_app_url,
        CASE WHEN mailer_shared_secret IS NOT NULL AND mailer_shared_secret <> '' THEN '••••' ELSE '' END AS mailer_shared_secret,
        COALESCE(mailer_mode, 'api') AS mailer_mode,
        COALESCE(mailer_enabled, false) AS mailer_enabled,
        updated_at
      FROM app_settings
      WHERE id = 1
      LIMIT 1
    `);

    const rows    = Array.from(result);
    const settings = rows.length > 0 ? rows[0] : null;
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/settings ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can save settings
  const role = (session.user as { role?: string }).role ?? "staff";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });

  try {
    const body = await request.json();

    await ensureSettingsSchema();

    const registrationSheetId   = (body.registration_sheet_id   as string | null)  ?? null;
    const registrationSheetName = (body.registration_sheet_name as string | null) || "Form Responses 1";
    const travelSheetName       = (body.travel_sheet_name       as string | null) || "Travel Desk Records";
    const dbVujisSheetName      = (body.db_vujis_sheet_name     as string | null) || "DB & vujis";
    const driveFolderId         = (body.drive_folder_id         as string | null)  ?? null;
    const gasWebAppUrl          = (body.gas_web_app_url         as string | null)  ?? null;
    const sessionTimeoutMinutes = Math.max(1, Math.min(480, parseInt(body.session_timeout_minutes ?? "30") || 30));
    // Backup fields
    const backupGasWebAppUrl      = (body.backup_gas_web_app_url       as string | null) ?? null;
    const backupSheetId           = (body.backup_sheet_id              as string | null) ?? null;
    const backupFolderId          = (body.backup_folder_id             as string | null) ?? null;
    const backupSheetId2          = (body.backup_sheet_id_2            as string | null) ?? null;
    const backupFolderId2         = (body.backup_folder_id_2           as string | null) ?? null;
    const dashboardPivotSheetName = (body.dashboard_pivot_sheet_name   as string | null) || null;
    
    // Mailer fields
    const mailerWebAppUrl       = (body.mailer_web_app_url           as string | null) ?? null;
    const mailerSharedSecret    = (body.mailer_shared_secret        as string | null) ?? null;
    const mailerMode            = (body.mailer_mode                 as string | null) || "api";
    const mailerEnabled         = !!body.mailer_enabled;

    await db.execute(sql`
      INSERT INTO app_settings (
        id,
        registration_sheet_id,
        registration_sheet_name,
        travel_sheet_name,
        db_vujis_sheet_name,
        drive_folder_id,
        gas_web_app_url,
        session_timeout_minutes,
        backup_gas_web_app_url,
        backup_sheet_id,
        backup_folder_id,
        backup_sheet_id_2,
        backup_folder_id_2,
        dashboard_pivot_sheet_name,
        mailer_web_app_url,
        mailer_shared_secret,
        mailer_mode,
        mailer_enabled,
        updated_at
      ) VALUES (
        1,
        ${registrationSheetId},
        ${registrationSheetName},
        ${travelSheetName},
        ${dbVujisSheetName},
        ${driveFolderId},
        ${gasWebAppUrl},
        ${sessionTimeoutMinutes},
        ${backupGasWebAppUrl},
        ${backupSheetId},
        ${backupFolderId},
        ${backupSheetId2},
        ${backupFolderId2},
        ${dashboardPivotSheetName},
        ${mailerWebAppUrl},
        ${mailerSharedSecret},
        ${mailerMode},
        ${mailerEnabled},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        registration_sheet_id      = EXCLUDED.registration_sheet_id,
        registration_sheet_name    = EXCLUDED.registration_sheet_name,
        travel_sheet_name          = EXCLUDED.travel_sheet_name,
        db_vujis_sheet_name        = EXCLUDED.db_vujis_sheet_name,
        drive_folder_id            = EXCLUDED.drive_folder_id,
        gas_web_app_url            = EXCLUDED.gas_web_app_url,
        session_timeout_minutes    = EXCLUDED.session_timeout_minutes,
        backup_gas_web_app_url     = EXCLUDED.backup_gas_web_app_url,
        backup_sheet_id            = EXCLUDED.backup_sheet_id,
        backup_folder_id           = EXCLUDED.backup_folder_id,
        backup_sheet_id_2          = EXCLUDED.backup_sheet_id_2,
        backup_folder_id_2         = EXCLUDED.backup_folder_id_2,
        dashboard_pivot_sheet_name = EXCLUDED.dashboard_pivot_sheet_name,
        mailer_web_app_url         = EXCLUDED.mailer_web_app_url,
        mailer_shared_secret       = CASE WHEN EXCLUDED.mailer_shared_secret = '••••' THEN app_settings.mailer_shared_secret ELSE EXCLUDED.mailer_shared_secret END,
        mailer_mode                = EXCLUDED.mailer_mode,
        mailer_enabled             = EXCLUDED.mailer_enabled,
        updated_at                 = NOW()
    `);

    const updated = Array.from(await db.execute(sql`
      SELECT * FROM app_settings WHERE id = 1 LIMIT 1
    `));

    return NextResponse.json({ ok: true, settings: updated[0] ?? null });
  } catch (err: unknown) {
    console.error("[POST /api/settings]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
