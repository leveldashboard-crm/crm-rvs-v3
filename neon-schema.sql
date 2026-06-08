-- ═══════════════════════════════════════════════════════════════════════════════
-- DelegateConnect CRM — Enterprise PostgreSQL Schema v5.0.0 (Extended Edition)
-- Target: Neon Serverless Postgres / Supabase / Native Postgres
-- ───────────────────────────────────────────────────────────────────────────────
-- DEPLOY: Open Neon SQL Editor -> Ctrl+A -> Ctrl+V -> Run
-- SAFE:   All statements use IF NOT EXISTS / ON CONFLICT — run multiple times safely
-- ORDER:  Tables -> Triggers -> Migrations -> Indexes -> Seed Data
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── OPTIONAL MASTER RESET (COMMENTED OUT FOR SAFETY) ───────────────────────
-- WARNING: Running this block will destroy all data!
-- DROP TABLE IF EXISTS audit_log             CASCADE;
-- DROP TABLE IF EXISTS chat_messages         CASCADE;
-- DROP TABLE IF EXISTS operation_permissions CASCADE;
-- DROP TABLE IF EXISTS communications_log    CASCADE;
-- DROP TABLE IF EXISTS session_attendance    CASCADE;
-- DROP TABLE IF EXISTS event_sessions        CASCADE;
-- DROP TABLE IF EXISTS travel_records        CASCADE;
-- DROP TABLE IF EXISTS db_vujis_records      CASCADE;
-- DROP TABLE IF EXISTS app_settings          CASCADE;
-- DROP TABLE IF EXISTS registrations         CASCADE;
-- DROP TABLE IF EXISTS users                 CASCADE;
-- DROP FUNCTION IF EXISTS trigger_set_timestamp CASCADE;
-- ───────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. UTILITY FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- The trigger_set_timestamp function ensures that the updated_at column is 
-- automatically updated to the current server time (NOW()) on every row update.
-- This guarantees an accurate modification history regardless of the application code.
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. USERS TABLE (RBAC & Authentication)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Stores staff accounts for accessing the CRM.
-- Features: Soft-delete (is_active), Role-Based Access Control (role), 
-- Last login tracking, and secure bcrypt password storage.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT,
  role          TEXT        DEFAULT 'user', -- 'admin', 'supervisor', 'user'
  is_active     BOOLEAN     DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP   DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMP   DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. REGISTRATIONS TABLE (Core Delegate Data)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: The central truth for delegate information synced from Google Forms.
-- Features: 40+ columns mapping directly to the intake form, Drive URL storage,
-- and approval status tracking.

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
  nature_of_business       TEXT,
  products_services        TEXT,
  main_import_product_1    TEXT,
  main_import_product_2    TEXT,
  bl_supplier_country      TEXT,
  bl_buyer_country         TEXT,
  passport_number          TEXT,
  place_of_issue           TEXT,
  date_of_expiry           TEXT,
  
  -- Raw Google Form File Uploads
  passport_front_copy      TEXT,
  passport_back_copy       TEXT,
  proof_upload             TEXT,
  business_card_upload     TEXT,
  
  -- Copied/Organized Google Drive View Links (Set by GAS)
  drive_passport_front_url TEXT,
  drive_passport_back_url  TEXT,
  drive_proof_url          TEXT,
  drive_business_card_url  TEXT,
  
  -- Additional Workflow Fields
  poc                      TEXT,
  proof_import             TEXT,
  type_of_poi              TEXT,
  status                   TEXT DEFAULT 'Pending',
  flight_hotel_code        TEXT,
  remarks                  TEXT,
  bl_status                TEXT,
  bb_invitation_status     TEXT,
  dollar_business          TEXT,
  vujis                    TEXT,
  will_not_attend          TEXT,
  
  is_active                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_registrations ON registrations;
CREATE TRIGGER set_timestamp_registrations
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. TRAVEL RECORDS TABLE (Logistics & Reimbursements)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Manages flights, hotels, visa documents, and financial reimbursements.
-- Features: Links to registrations, tracks physical/digital document receipt,
-- stores Google Drive IDs for advanced file management.

CREATE TABLE IF NOT EXISTS travel_records (
  id                     SERIAL PRIMARY KEY,
  registration_id        INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
  responses_sr_no        TEXT,
  initial                TEXT,
  first_name             TEXT,
  last_name              TEXT,
  country_name           TEXT,
  country_code           TEXT,
  participant_mobile     TEXT,
  company_name           TEXT,
  sector                 TEXT,
  poc                    TEXT,
  
  -- Hotel & Accommodation
  hotel_name             TEXT,
  room_no                TEXT,
  check_in_date          TEXT,
  check_out_date         TEXT,
  room_units             NUMERIC(4,2),
  
  -- Flight Logistics
  arrival_date           TEXT,
  arrival_flight_no      TEXT,
  arrival_to             TEXT,
  arrival_time           TEXT,
  departure_date         TEXT,
  departure_flight_no    TEXT,
  departure_from         TEXT,
  departure_time         TEXT,
  
  -- Workflow Status
  status                 TEXT DEFAULT 'Pending',
  notes                  TEXT,
  
  -- Financials
  reimbursement          TEXT DEFAULT 'No',
  reimbursement_amount   TEXT,
  invoice_amount         TEXT,
  invoice_amount_usd     TEXT,
  invoice_amount_local   TEXT,
  invoice_currency       TEXT,
  
  -- Document Tracking
  ticket_received        TEXT DEFAULT 'No',
  invoice_received       TEXT DEFAULT 'No',
  visa_received          TEXT DEFAULT 'No',
  passport_copy_received TEXT DEFAULT 'No',
  voucher_received       TEXT DEFAULT 'No',
  
  bl                     TEXT,
  
  -- Google Drive URLs (View Links)
  bl_url                 TEXT,
  ticket_url             TEXT,
  invoice_url            TEXT,
  visa_url               TEXT,
  passport_url           TEXT,
  voucher_url            TEXT,
  business_card_url      TEXT,
  
  -- Google Drive File IDs (For API Operations)
  bl_drive_id            TEXT,
  ticket_drive_id        TEXT,
  invoice_drive_id       TEXT,
  visa_drive_id          TEXT,
  passport_drive_id      TEXT,
  voucher_drive_id       TEXT,
  business_card_drive_id TEXT,
  
  created_at             TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at             TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_travel_records ON travel_records;
CREATE TRIGGER set_timestamp_travel_records
  BEFORE UPDATE ON travel_records
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DB & VUJIS RECORDS TABLE (Financial Verifications)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Tracks verification of import status, financial checks, and Vujis status.
-- Features: Detailed fields for verifying business volume and import validity.

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
  
  created_at                   TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at                   TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_db_vujis ON db_vujis_records;
CREATE TRIGGER set_timestamp_db_vujis
  BEFORE UPDATE ON db_vujis_records
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. APP SETTINGS TABLE (Singleton Configuration)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Global system configuration accessible by admins.
-- Features: Google Sheets mapping, session timeouts, backup environments.

CREATE TABLE IF NOT EXISTS app_settings (
  id                           INTEGER PRIMARY KEY DEFAULT 1,
  registration_sheet_id        TEXT,
  registration_sheet_name      TEXT DEFAULT 'Form Responses 1',
  travel_sheet_name            TEXT DEFAULT 'Travel Desk Records',
  db_vujis_sheet_name          TEXT DEFAULT 'DB & vujis',
  drive_folder_id              TEXT,
  gas_web_app_url              TEXT,
  
  -- Session Security Configuration
  session_timeout_minutes      INTEGER DEFAULT 30,
  
  -- Secondary Backup Strategy Configuration
  backup_gas_web_app_url       TEXT,
  backup_sheet_id              TEXT,
  backup_folder_id             TEXT,
  backup_sheet_id_2            TEXT,
  backup_folder_id_2           TEXT,
  
  dashboard_pivot_sheet_name   TEXT,
  updated_at                   TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_app_settings ON app_settings;
CREATE TRIGGER set_timestamp_app_settings
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. AUDIT LOG TABLE (Compliance & Paper Trail)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Immutable record of all system operations, overwrites, and security events.
-- Features: User attribution, IP tracking, JSONB metadata payloads, no UPDATES.

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT,
  user_role   TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  status      TEXT DEFAULT 'success',
  ip_address  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. OPERATION PERMISSIONS TABLE (Supervisor Overwrite Approval Flow)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Tracks requests by supervisors to overwrite critical data which require
-- admin approval before proceeding.
-- Features: Request/Approve flow, TTL expiration.

CREATE TABLE IF NOT EXISTS operation_permissions (
  id               SERIAL PRIMARY KEY,
  requested_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  operation        TEXT NOT NULL,
  description      TEXT,
  status           TEXT DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'revoked'
  approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by_name TEXT,
  confirmed_at     TIMESTAMP,
  expires_at       TIMESTAMP,
  metadata         JSONB,
  created_at       TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_operation_permissions ON operation_permissions;
CREATE TRIGGER set_timestamp_operation_permissions
  BEFORE UPDATE ON operation_permissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. CHAT MESSAGES TABLE (Internal Staff Communication)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Internal real-time messaging between staff/admins.
-- Features: Sender/Recipient tracking, file attachment references, edit tracking.

CREATE TABLE IF NOT EXISTS chat_messages (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  file_url     TEXT,
  file_name    TEXT,
  is_edited    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Note: chat_messages is typically immutable apart from soft edits, so no updated_at trigger by default.
-- But if edits are heavy, it could be added.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. COMMUNICATIONS LOG (Email & SMS Tracking) [NEW FEATURE]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Records all automated or manual emails and SMS sent to delegates.
-- Features: Delivery status, payload storage, communication type tracking.

CREATE TABLE IF NOT EXISTS communications_log (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
  sent_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  recipient_addr  TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  status          TEXT DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'failed', 'bounced'
  provider_id     TEXT, -- e.g., SendGrid/Twilio message ID
  error_message   TEXT,
  sent_at         TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. EVENT SESSIONS & ATTENDANCE [NEW FEATURE]
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose: Allows scheduling of conference sessions, B2B meetings, or workshops
-- and tracking which delegates attended which session via QR code scanning.

CREATE TABLE IF NOT EXISTS event_sessions (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  speaker_name  TEXT,
  start_time    TIMESTAMP NOT NULL,
  end_time      TIMESTAMP NOT NULL,
  capacity      INTEGER,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_event_sessions ON event_sessions;
CREATE TRIGGER set_timestamp_event_sessions
  BEFORE UPDATE ON event_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS session_attendance (
  id              SERIAL PRIMARY KEY,
  session_id      INTEGER REFERENCES event_sessions(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
  scanned_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scanned_at      TIMESTAMP DEFAULT NOW() NOT NULL,
  status          TEXT DEFAULT 'attended', -- 'attended', 'registered', 'no-show'
  UNIQUE (session_id, registration_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. IDEMPOTENT COLUMN MIGRATIONS (Zero-Downtime Alterations)
-- ═══════════════════════════════════════════════════════════════════════════════
-- This section ensures that applying this script to an older version of the 
-- database will safely add any missing columns without data loss.

-- Users Migrations
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN   DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Registrations Migrations (Exhaustive Column Checklist)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS sr_no                    INTEGER,
  ADD COLUMN IF NOT EXISTS timestamp_raw            TEXT,
  ADD COLUMN IF NOT EXISTS title                    TEXT,
  ADD COLUMN IF NOT EXISTS first_name               TEXT,
  ADD COLUMN IF NOT EXISTS last_name                TEXT,
  ADD COLUMN IF NOT EXISTS country_name             TEXT,
  ADD COLUMN IF NOT EXISTS passport_country         TEXT,
  ADD COLUMN IF NOT EXISTS region                   TEXT,
  ADD COLUMN IF NOT EXISTS participant_mobile       TEXT,
  ADD COLUMN IF NOT EXISTS participant_email        TEXT,
  ADD COLUMN IF NOT EXISTS company_name             TEXT,
  ADD COLUMN IF NOT EXISTS company_website          TEXT,
  ADD COLUMN IF NOT EXISTS designation              TEXT,
  ADD COLUMN IF NOT EXISTS nature_of_business       TEXT,
  ADD COLUMN IF NOT EXISTS products_services        TEXT,
  ADD COLUMN IF NOT EXISTS main_import_product_1    TEXT,
  ADD COLUMN IF NOT EXISTS main_import_product_2    TEXT,
  ADD COLUMN IF NOT EXISTS bl_supplier_country      TEXT,
  ADD COLUMN IF NOT EXISTS bl_buyer_country         TEXT,
  ADD COLUMN IF NOT EXISTS passport_number          TEXT,
  ADD COLUMN IF NOT EXISTS place_of_issue           TEXT,
  ADD COLUMN IF NOT EXISTS date_of_expiry           TEXT,
  ADD COLUMN IF NOT EXISTS passport_front_copy      TEXT,
  ADD COLUMN IF NOT EXISTS passport_back_copy       TEXT,
  ADD COLUMN IF NOT EXISTS proof_upload             TEXT,
  ADD COLUMN IF NOT EXISTS business_card_upload     TEXT,
  ADD COLUMN IF NOT EXISTS drive_passport_front_url TEXT,
  ADD COLUMN IF NOT EXISTS drive_passport_back_url  TEXT,
  ADD COLUMN IF NOT EXISTS drive_proof_url          TEXT,
  ADD COLUMN IF NOT EXISTS drive_business_card_url  TEXT,
  ADD COLUMN IF NOT EXISTS poc                      TEXT,
  ADD COLUMN IF NOT EXISTS proof_import             TEXT,
  ADD COLUMN IF NOT EXISTS type_of_poi              TEXT,
  ADD COLUMN IF NOT EXISTS status                   TEXT,
  ADD COLUMN IF NOT EXISTS flight_hotel_code        TEXT,
  ADD COLUMN IF NOT EXISTS remarks                  TEXT,
  ADD COLUMN IF NOT EXISTS bl_status                TEXT,
  ADD COLUMN IF NOT EXISTS bb_invitation_status     TEXT,
  ADD COLUMN IF NOT EXISTS dollar_business          TEXT,
  ADD COLUMN IF NOT EXISTS vujis                    TEXT,
  ADD COLUMN IF NOT EXISTS will_not_attend          TEXT,
  ADD COLUMN IF NOT EXISTS is_active                BOOLEAN DEFAULT TRUE;

-- Travel Records Migrations
ALTER TABLE travel_records
  ADD COLUMN IF NOT EXISTS initial                TEXT,
  ADD COLUMN IF NOT EXISTS country_code           TEXT,
  -- Cast room_units if it was TEXT previously. (Requires manual attention if casting fails, skipped safe ALTER)
  -- Add columns if missing
  ADD COLUMN IF NOT EXISTS reimbursement_amount   TEXT,
  ADD COLUMN IF NOT EXISTS invoice_amount_local   TEXT,
  ADD COLUMN IF NOT EXISTS invoice_currency       TEXT,
  ADD COLUMN IF NOT EXISTS bl                     TEXT,
  ADD COLUMN IF NOT EXISTS bl_url                 TEXT,
  ADD COLUMN IF NOT EXISTS bl_drive_id            TEXT,
  ADD COLUMN IF NOT EXISTS business_card_url      TEXT,
  ADD COLUMN IF NOT EXISTS business_card_drive_id TEXT;

-- App Settings Migrations
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS registration_sheet_name TEXT DEFAULT 'Form Responses 1',
  ADD COLUMN IF NOT EXISTS travel_sheet_name       TEXT DEFAULT 'Travel Desk Records',
  ADD COLUMN IF NOT EXISTS db_vujis_sheet_name     TEXT DEFAULT 'DB & vujis',
  ADD COLUMN IF NOT EXISTS drive_folder_id         TEXT,
  ADD COLUMN IF NOT EXISTS gas_web_app_url         TEXT,
  ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS backup_gas_web_app_url  TEXT,
  ADD COLUMN IF NOT EXISTS backup_sheet_id         TEXT,
  ADD COLUMN IF NOT EXISTS backup_folder_id        TEXT,
  ADD COLUMN IF NOT EXISTS backup_sheet_id_2       TEXT,
  ADD COLUMN IF NOT EXISTS backup_folder_id_2      TEXT,
  ADD COLUMN IF NOT EXISTS dashboard_pivot_sheet_name TEXT;

-- Audit Log Migrations (Adding fields for advanced auditing)
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_name  TEXT,
  ADD COLUMN IF NOT EXISTS user_role  TEXT,
  ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS ip_address TEXT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. HIGH-PERFORMANCE INDEXES (B-Tree & GIN)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Critical for dashboards with thousands of records. Covers common filters and
-- aggregations. Run AFTER migrations.

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- Registrations Indexes
CREATE INDEX IF NOT EXISTS idx_reg_sr_no      ON registrations (sr_no);
CREATE INDEX IF NOT EXISTS idx_reg_status     ON registrations (status);
CREATE INDEX IF NOT EXISTS idx_reg_country    ON registrations (country_name);
CREATE INDEX IF NOT EXISTS idx_reg_company    ON registrations (company_name);
CREATE INDEX IF NOT EXISTS idx_reg_first_name ON registrations (first_name);
CREATE INDEX IF NOT EXISTS idx_reg_last_name  ON registrations (last_name);
CREATE INDEX IF NOT EXISTS idx_reg_email      ON registrations (participant_email);
CREATE INDEX IF NOT EXISTS idx_reg_poc        ON registrations (poc);
CREATE INDEX IF NOT EXISTS idx_reg_product_1  ON registrations (main_import_product_1);
CREATE INDEX IF NOT EXISTS idx_reg_product_2  ON registrations (main_import_product_2);
CREATE INDEX IF NOT EXISTS idx_reg_bl_status  ON registrations (bl_status);
CREATE INDEX IF NOT EXISTS idx_reg_created_at ON registrations (created_at DESC);

-- Travel Records Indexes
CREATE INDEX IF NOT EXISTS idx_trv_reg_id         ON travel_records (registration_id);
CREATE INDEX IF NOT EXISTS idx_trv_sr_no          ON travel_records (responses_sr_no);
CREATE INDEX IF NOT EXISTS idx_trv_status         ON travel_records (status);
CREATE INDEX IF NOT EXISTS idx_trv_hotel          ON travel_records (hotel_name);
CREATE INDEX IF NOT EXISTS idx_trv_poc            ON travel_records (poc);
CREATE INDEX IF NOT EXISTS idx_trv_country        ON travel_records (country_name);
CREATE INDEX IF NOT EXISTS idx_trv_sector         ON travel_records (sector);
CREATE INDEX IF NOT EXISTS idx_trv_arrival_date   ON travel_records (arrival_date);
CREATE INDEX IF NOT EXISTS idx_trv_departure_date ON travel_records (departure_date);
CREATE INDEX IF NOT EXISTS idx_trv_check_in       ON travel_records (check_in_date);
CREATE INDEX IF NOT EXISTS idx_trv_reimbursement  ON travel_records (reimbursement);
CREATE INDEX IF NOT EXISTS idx_trv_created_at     ON travel_records (created_at DESC);

-- DB & Vujis Indexes
CREATE INDEX IF NOT EXISTS idx_dbv_sr_no          ON db_vujis_records (sr_no);
CREATE INDEX IF NOT EXISTS idx_dbv_company        ON db_vujis_records (company_name);

-- Audit Log Indexes (For rapid compliance lookups)
CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at DESC);

-- Specialized JSONB Index for Audit Metadata Search (GIN Index)
CREATE INDEX IF NOT EXISTS idx_audit_metadata_gin ON audit_log USING GIN (metadata);

-- Operation Permissions Indexes
CREATE INDEX IF NOT EXISTS idx_op_req_by        ON operation_permissions (requested_by);
CREATE INDEX IF NOT EXISTS idx_op_status        ON operation_permissions (status);

-- Chat Messages Indexes
CREATE INDEX IF NOT EXISTS idx_chat_users       ON chat_messages (user_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at  ON chat_messages (created_at DESC);

-- Communications Log Indexes
CREATE INDEX IF NOT EXISTS idx_comm_reg_id      ON communications_log (registration_id);
CREATE INDEX IF NOT EXISTS idx_comm_status      ON communications_log (status);

-- Session Attendance Indexes
CREATE INDEX IF NOT EXISTS idx_att_session      ON session_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_att_registration ON session_attendance (registration_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. SEED DATA INITIALIZATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Seed App Settings (Singleton ID=1)
INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Admin Account
-- Credentials: admin / manthan18
-- Re-running this script resets the password back to default (useful if locked out).
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin',
  '$2a$12$K7thZh9FoqF.G4vE3c6i0eOKCEBFpD8C1oJbFb2VLPfXrk3vHDVFi',
  'System Administrator',
  'admin'
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      name          = 'System Administrator',
      role          = 'admin';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. ARCHITECTURE & FUNCTIONALITY DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- The DelegateConnect CRM is a comprehensive data management platform bridging
-- Google Forms, Google Sheets, Google Drive, and Next.js React dashboards.
-- 
-- TABLE MAP:
-- 1. users: Staff accounts, passwords, roles (admin/supervisor/user).
-- 2. registrations: The massive intake form table. Every delegate response.
-- 3. travel_records: Flight logistics, hotels, physical/digital document states.
-- 4. db_vujis_records: Financial verification and historical data mapping.
-- 5. app_settings: Singleton configuration (Google Drive IDs, webhook URLs).
-- 6. audit_log: Immutable action trail with JSONB payloads.
-- 7. operation_permissions: Approval workflows for dangerous actions (overwrites).
-- 8. chat_messages: Internal team messaging.
-- 9. communications_log: Email and SMS tracking.
-- 10. event_sessions: Agenda and schedule management.
-- 11. session_attendance: QR Code scanning and attendance tracking.
-- 
-- ── INTEGRATIONS ───────────────────────────────────────────────────────────────
-- 
-- [GOOGLE SHEETS]
-- Data is written back to Google Sheets via Google Apps Script (GAS) Web Apps.
-- The API endpoints in Next.js make HTTP POST calls to the GAS Web App URL
-- stored in `app_settings.gas_web_app_url`.
-- The script handles formatting, border drawing, and data validation directly
-- in the Google Sheet.
-- 
-- [GOOGLE DRIVE]
-- Documents (Passports, Visas, B/L Proofs) uploaded via the Google Form are
-- processed by GAS. The GAS script reads the raw URL from the form response,
-- copies the file into a dedicated subfolder for that specific delegate,
-- and returns the new structured Drive URLs and File IDs back to PostgreSQL.
-- 
-- [NEON POSTGRES SERVERLESS]
-- This database schema is optimized for Neon Serverless Postgres.
-- - Connection Pooling: Use PgBouncer endpoints (neon.tech connection strings).
-- - Cold Starts: The database scales to zero. Initial API hits may take 1-2s.
-- - Read Replicas: GIN and B-Tree indexes are configured so read-replicas
--   can rapidly serve dashboard analytics without interrupting write traffic.
-- 
-- ── SECURITY PROTOCOLS ─────────────────────────────────────────────────────────
-- 
-- 1. Hard Deletes vs Soft Deletes:
--    `users` and `registrations` have `is_active` flags for soft deletion.
--    However, the system primarily relies on Hard Deletes accompanied by robust
--    Audit Logging. When a record is hard deleted, the `audit_log` retains the
--    metadata and attribution.
-- 
-- 2. Supervisor Approvals:
--    Supervisors cannot perform mass overwrites. They must request an overwrite,
--    creating a record in `operation_permissions`. An admin approves it,
--    changing the status and triggering the operation.
-- 
-- 3. Passwords & Authentication:
--    Managed via NextAuth credentials provider using bcrypt. Minimum cost factor 12.
-- 
-- ── DEVELOPMENT & DEPLOYMENT ───────────────────────────────────────────────────
-- 
-- 1. To apply schema updates: Simply copy-paste this entire file into the Neon SQL Editor.
-- 2. All ALTER TABLE statements are safe and idempotent.
-- 3. If altering column types (e.g. TEXT to NUMERIC), write custom USING clauses
--    or manually resolve data casting issues.
-- 4. Environment Variables Required in Vercel:
--    - DATABASE_URL
--    - NEXTAUTH_SECRET
--    - NEXTAUTH_URL
--    - NEXT_PUBLIC_GAS_WEB_APP_URL
-- 
-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF SCHEMA DEFINITION
-- ═══════════════════════════════════════════════════════════════════════════════
