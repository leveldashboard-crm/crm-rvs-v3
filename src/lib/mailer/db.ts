import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// ─── Schema migration (run once per process) ──────────────────────────────────
let _migrated = false;
export async function ensureMailerSchema() {
  if (_migrated) return;
  const stmts = [
    // Mailer Drafts
    `CREATE TABLE IF NOT EXISTS mailer_drafts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      plain_body TEXT NOT NULL DEFAULT '',
      cc TEXT NOT NULL DEFAULT '',
      bcc TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // Mailer Send Log
    `CREATE TABLE IF NOT EXISTS mailer_send_log (
      id SERIAL PRIMARY KEY,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      recipient TEXT,
      email TEXT,
      subject TEXT,
      draft_name TEXT,
      has_letter BOOLEAN DEFAULT false,
      has_card BOOLEAN DEFAULT false,
      has_itinerary BOOLEAN DEFAULT false,
      has_voucher BOOLEAN DEFAULT false,
      custom_attachments TEXT,
      status TEXT DEFAULT 'success',
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // Mailer File Index (stores indexed Drive PDF files per type)
    `CREATE TABLE IF NOT EXISTS mailer_file_index (
      id SERIAL PRIMARY KEY,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      name_normalized TEXT NOT NULL,
      indexed_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // Mailer folder config stored in app_settings — add columns if missing
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_smtp_host TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_smtp_port INTEGER DEFAULT 587`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_smtp_user TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_smtp_pass TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_smtp_from TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_folder_letter TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_folder_card TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_folder_itinerary TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_folder_voucher TEXT`,
    `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS mailer_drive_api_key TEXT`,
  ];
  for (const stmt of stmts) {
    try { await db.execute(sql.raw(stmt)); } catch { /* already exists */ }
  }
  _migrated = true;
}

// ─── Settings loader ──────────────────────────────────────────────────────────
export interface MailerSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  folderLetter: string;
  folderCard: string;
  folderItinerary: string;
  folderVoucher: string;
  driveApiKey: string;
}

export async function loadMailerSettings(): Promise<MailerSettings> {
  await ensureMailerSchema();
  const rows = Array.from(await db.execute(sql`
    SELECT
      COALESCE(mailer_smtp_host, '') AS mailer_smtp_host,
      COALESCE(mailer_smtp_port, 587) AS mailer_smtp_port,
      COALESCE(mailer_smtp_user, '') AS mailer_smtp_user,
      COALESCE(mailer_smtp_pass, '') AS mailer_smtp_pass,
      COALESCE(mailer_smtp_from, '') AS mailer_smtp_from,
      COALESCE(mailer_folder_letter, '') AS mailer_folder_letter,
      COALESCE(mailer_folder_card, '') AS mailer_folder_card,
      COALESCE(mailer_folder_itinerary, '') AS mailer_folder_itinerary,
      COALESCE(mailer_folder_voucher, '') AS mailer_folder_voucher,
      COALESCE(mailer_drive_api_key, '') AS mailer_drive_api_key
    FROM app_settings WHERE id = 1 LIMIT 1
  `));
  const row = (rows[0] || {}) as Record<string, unknown>;
  return {
    smtpHost: String(row.mailer_smtp_host || process.env.MAILER_SMTP_HOST || "smtp.gmail.com"),
    smtpPort: Number(row.mailer_smtp_port || process.env.MAILER_SMTP_PORT || 587),
    smtpUser: String(row.mailer_smtp_user || process.env.MAILER_SMTP_USER || ""),
    smtpPass: String(row.mailer_smtp_pass || process.env.MAILER_SMTP_PASS || ""),
    smtpFrom: String(row.mailer_smtp_from || process.env.MAILER_SMTP_FROM || ""),
    folderLetter: String(row.mailer_folder_letter || process.env.MAILER_FOLDER_LETTER || ""),
    folderCard: String(row.mailer_folder_card || process.env.MAILER_FOLDER_CARD || ""),
    folderItinerary: String(row.mailer_folder_itinerary || process.env.MAILER_FOLDER_ITINERARY || ""),
    folderVoucher: String(row.mailer_folder_voucher || process.env.MAILER_FOLDER_VOUCHER || ""),
    driveApiKey: String(row.mailer_drive_api_key || process.env.MAILER_DRIVE_API_KEY || ""),
  };
}
