import { NextResponse } from "next/server";
import postgres from "postgres";
import { hashSync } from "bcryptjs";

// GET /api/setup — one-time DB init + admin seed
// Protected by ADMIN_SECRET_KEY query param
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: "Forbidden. Pass ?key=YOUR_ADMIN_SECRET_KEY" }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const sql = postgres(dbUrl, { prepare: false });
  const results: { step: string; status: string; error?: string }[] = [];

  const run = async (step: string, query: string) => {
    try {
      await sql.unsafe(query);
      results.push({ step, status: "✓" });
    } catch (err: unknown) {
      results.push({ step, status: "✗", error: err instanceof Error ? err.message : String(err) });
    }
  };

  // ── 1. Users ──────────────────────────────────────────────────────────────────
  await run("users table", `
    CREATE TABLE IF NOT EXISTS users (
      id               SERIAL PRIMARY KEY,
      email            TEXT NOT NULL UNIQUE,
      password_hash    TEXT NOT NULL,
      name             TEXT,
      role             TEXT NOT NULL DEFAULT 'staff',
      is_active        BOOLEAN DEFAULT true,
      last_login_at    TIMESTAMP,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 2. Registrations ──────────────────────────────────────────────────────────
  await run("registrations table", `
    CREATE TABLE IF NOT EXISTS registrations (
      id                       SERIAL PRIMARY KEY,
      sr_no                    INTEGER UNIQUE,
      timestamp_raw            TEXT,
      title                    TEXT,
      first_name               TEXT,
      last_name                TEXT,
      country_name             TEXT,
      passport_country         TEXT,
      region                   TEXT,
      participant_mobile       TEXT,
      participant_email        TEXT,
      company_name             TEXT,
      company_website          TEXT,
      designation              TEXT,
      passport_number          TEXT,
      place_of_issue           TEXT,
      date_of_expiry           TEXT,
      passport_front_copy      TEXT,
      passport_back_copy       TEXT,
      nature_of_business       TEXT,
      main_import_product_1    TEXT,
      main_import_product_2    TEXT,
      proof_upload             TEXT,
      products_services        TEXT,
      business_card_upload     TEXT,
      poc                      TEXT,
      proof_import             TEXT,
      type_of_poi              TEXT,
      bl_supplier_country      TEXT,
      bl_buyer_country         TEXT,
      status                   TEXT,
      flight_hotel_code        TEXT,
      remarks                  TEXT,
      bl_status                TEXT,
      bb_invitation_status     TEXT,
      dollar_business          TEXT,
      vujis                    TEXT,
      will_not_attend          TEXT,
      is_active                BOOLEAN DEFAULT true,
      drive_passport_front_url TEXT,
      drive_passport_back_url  TEXT,
      drive_proof_url          TEXT,
      drive_business_card_url  TEXT,
      created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 3. Travel Records ─────────────────────────────────────────────────────────
  await run("travel_records table", `
    CREATE TABLE IF NOT EXISTS travel_records (
      id                     SERIAL PRIMARY KEY,
      registration_id        INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
      responses_sr_no        TEXT,
      room_no                TEXT,
      hotel_name             TEXT,
      initial                TEXT,
      first_name             TEXT,
      last_name              TEXT,
      country_name           TEXT,
      country_code           TEXT,
      participant_mobile     TEXT,
      check_in_date          DATE,
      check_out_date         DATE,
      room_units             NUMERIC(4,2),
      arrival_date           DATE,
      arrival_flight_no      TEXT,
      arrival_to             TEXT,
      arrival_time           TIME,
      departure_date         DATE,
      departure_flight_no    TEXT,
      departure_from         TEXT,
      departure_time         TIME,
      sector                 TEXT,
      company_name           TEXT,
      poc                    TEXT,
      status                 TEXT DEFAULT 'Pending',
      reimbursement          TEXT DEFAULT 'No',
      notes                  TEXT,
      invoice_amount         TEXT,
      invoice_amount_usd     TEXT,
      invoice_amount_local   TEXT,
      invoice_currency       TEXT,
      ticket_received        TEXT DEFAULT 'No',
      invoice_received       TEXT DEFAULT 'No',
      visa_received          TEXT DEFAULT 'No',
      passport_copy_received TEXT DEFAULT 'No',
      voucher_received       TEXT DEFAULT 'No',
      reimbursement_amount   TEXT,
      bl                     TEXT,
      bl_url                 TEXT,
      ticket_url             TEXT,
      invoice_url            TEXT,
      visa_url               TEXT,
      passport_url           TEXT,
      voucher_url            TEXT,
      business_card_url      TEXT,
      ticket_drive_id        TEXT,
      invoice_drive_id       TEXT,
      visa_drive_id          TEXT,
      passport_drive_id      TEXT,
      voucher_drive_id       TEXT,
      business_card_drive_id TEXT,
      bl_drive_id            TEXT,
      created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 4. DB & Vujis Records ─────────────────────────────────────────────────────
  await run("db_vujis_records table", `
    CREATE TABLE IF NOT EXISTS db_vujis_records (
      id                           SERIAL PRIMARY KEY,
      sr_no                        INTEGER UNIQUE,
      company_name                 TEXT,
      country_name                 TEXT,
      region                       TEXT,
      proof_of_import_y            TEXT,
      proof_of_import_n            TEXT,
      vujis                        TEXT,
      import_value_vujis           TEXT,
      dollar_business              TEXT,
      import_value_dollar          TEXT,
      both_db_vujis                TEXT,
      importing_from_india         TEXT,
      importing_from_other_country TEXT,
      main_import_product_1        TEXT,
      main_import_product_2        TEXT,
      poc                          TEXT,
      reason                       TEXT,
      comment                      TEXT,
      created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at                   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 5. App Settings ───────────────────────────────────────────────────────────
  await run("app_settings table", `
    CREATE TABLE IF NOT EXISTS app_settings (
      id                         INTEGER PRIMARY KEY DEFAULT 1,
      registration_sheet_id      TEXT,
      registration_sheet_name    TEXT DEFAULT 'Form Responses 1',
      travel_sheet_name          TEXT DEFAULT 'Travel Desk Records',
      db_vujis_sheet_name        TEXT DEFAULT 'DB & vujis',
      drive_folder_id            TEXT,
      gas_web_app_url            TEXT,
      session_timeout_minutes    INTEGER DEFAULT 30,
      backup_gas_web_app_url     TEXT,
      backup_sheet_id            TEXT,
      backup_folder_id           TEXT,
      backup_sheet_id_2          TEXT,
      backup_folder_id_2         TEXT,
      dashboard_pivot_sheet_name TEXT,
      mailer_web_app_url         TEXT,
      mailer_shared_secret       TEXT,
      mailer_mode                TEXT DEFAULT 'api',
      mailer_enabled             BOOLEAN DEFAULT false,
      updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 6. Audit Log ──────────────────────────────────────────────────────────────
  await run("audit_log table", `
    CREATE TABLE IF NOT EXISTS audit_log (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER,
      user_name   TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      status      TEXT DEFAULT 'success',
      ip_address  TEXT,
      metadata    JSONB,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 7. Operation Permissions ──────────────────────────────────────────────────
  await run("operation_permissions table", `
    CREATE TABLE IF NOT EXISTS operation_permissions (
      id                SERIAL PRIMARY KEY,
      requested_by      INTEGER,
      requested_by_name TEXT,
      operation         TEXT NOT NULL,
      description       TEXT,
      status            TEXT DEFAULT 'pending',
      approved_by       INTEGER,
      approved_by_name  TEXT,
      confirmed_at      TIMESTAMP,
      expires_at        TIMESTAMP,
      metadata          JSONB,
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 8. Chat Messages ─────────────────────────────────────────────────────────
  await run("chat_messages table", `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message      TEXT NOT NULL,
      file_url     TEXT,
      file_name    TEXT,
      is_edited    BOOLEAN DEFAULT false,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── 9. Default settings row ───────────────────────────────────────────────────
  await run("default settings row", `INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

  // ── 10. Seed admin user (parameterised — no SQL injection) ─────────────────────
  const passwordHash = hashSync("manthan18", 12);
  try {
    await sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('admin', ${passwordHash}, 'Admin', 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
    `;
    results.push({ step: "admin user (admin/manthan18)", status: "✓" });
  } catch (err: unknown) {
    results.push({ step: "admin user (admin/manthan18)", status: "✗", error: err instanceof Error ? err.message : String(err) });
  }

  await sql.end();

  const allOk = results.every((r) => r.status === "✓");

  return NextResponse.json({
    ok: allOk,
    message: allOk
      ? "✅ Database initialized! You can now login with: admin / manthan18"
      : "⚠️ Some steps had errors — check results below",
    results,
    credentials: allOk ? { username: "admin", password: "manthan18" } : undefined,
  });
}
