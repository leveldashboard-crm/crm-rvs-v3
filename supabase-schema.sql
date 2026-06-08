-- ═══════════════════════════════════════════════════════════════════════════════
-- DelegateConnect CRM — Supabase PostgreSQL Schema v5.0.0
-- Target: Supabase SQL Editor
-- ───────────────────────────────────────────────────────────────────────────────
-- DEPLOY: Go to Supabase -> SQL Editor -> Paste -> Click Run
-- NOTE: If prompted, select "Run without RLS" or run this script which explicitly
--       disables Row Level Security (RLS) so the Next.js CRM can manage it.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. UTILITY FUNCTIONS & TRIGGERS ───
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. USERS TABLE ───
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT,
  role          TEXT        NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN     DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP   DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMP   DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ─── 3. REGISTRATIONS TABLE ───
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
  
  passport_front_copy      TEXT,
  passport_back_copy       TEXT,
  proof_upload             TEXT,
  business_card_upload     TEXT,
  
  drive_passport_front_url TEXT,
  drive_passport_back_url  TEXT,
  drive_proof_url          TEXT,
  drive_business_card_url  TEXT,
  
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

-- ─── 4. TRAVEL RECORDS TABLE ───
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
  
  hotel_name             TEXT,
  room_no                TEXT,
  check_in_date          TEXT,
  check_out_date         TEXT,
  room_units             NUMERIC(4,2),
  
  arrival_date           TEXT,
  arrival_flight_no      TEXT,
  arrival_to             TEXT,
  arrival_time           TEXT,
  departure_date         TEXT,
  departure_flight_no    TEXT,
  departure_from         TEXT,
  departure_time         TEXT,
  
  status                 TEXT DEFAULT 'Pending',
  notes                  TEXT,
  
  reimbursement          TEXT DEFAULT 'No',
  reimbursement_amount   TEXT,
  invoice_amount         TEXT,
  invoice_amount_usd     TEXT,
  invoice_amount_local   TEXT,
  invoice_currency       TEXT,
  
  ticket_received        TEXT DEFAULT 'No',
  invoice_received       TEXT DEFAULT 'No',
  visa_received          TEXT DEFAULT 'No',
  passport_copy_received TEXT DEFAULT 'No',
  voucher_received       TEXT DEFAULT 'No',
  
  bl                     TEXT,
  
  bl_url                 TEXT,
  ticket_url             TEXT,
  invoice_url            TEXT,
  visa_url               TEXT,
  passport_url           TEXT,
  voucher_url            TEXT,
  business_card_url      TEXT,
  
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

-- ─── 5. DB & VUJIS RECORDS TABLE ───
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

-- ─── 6. APP SETTINGS TABLE ───
CREATE TABLE IF NOT EXISTS app_settings (
  id                           INTEGER PRIMARY KEY DEFAULT 1,
  registration_sheet_id        TEXT,
  registration_sheet_name      TEXT DEFAULT 'Form Responses 1',
  travel_sheet_name            TEXT DEFAULT 'Travel Desk Records',
  db_vujis_sheet_name          TEXT DEFAULT 'DB & vujis',
  drive_folder_id              TEXT,
  gas_web_app_url              TEXT,
  session_timeout_minutes      INTEGER DEFAULT 30,
  backup_gas_web_app_url       TEXT,
  backup_sheet_id              TEXT,
  backup_folder_id             TEXT,
  backup_sheet_id_2            TEXT,
  backup_folder_id_2           TEXT,
  dashboard_pivot_sheet_name   TEXT,
  mailer_web_app_url           TEXT,
  mailer_shared_secret         TEXT,
  mailer_mode                  TEXT DEFAULT 'api',
  mailer_enabled               BOOLEAN DEFAULT FALSE,
  updated_at                   TIMESTAMP DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_app_settings ON app_settings;
CREATE TRIGGER set_timestamp_app_settings
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ─── 7. AUDIT LOG TABLE ───
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

-- ─── 8. OPERATION PERMISSIONS TABLE ───
CREATE TABLE IF NOT EXISTS operation_permissions (
  id               SERIAL PRIMARY KEY,
  requested_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  operation        TEXT NOT NULL,
  description      TEXT,
  status           TEXT DEFAULT 'pending',
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

-- ─── 9. CHAT MESSAGES TABLE ───
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

-- ─── 10. COMMUNICATIONS LOG ───
CREATE TABLE IF NOT EXISTS communications_log (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
  sent_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  recipient_addr  TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  status          TEXT DEFAULT 'sent',
  provider_id     TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ─── 11. EVENT SESSIONS & ATTENDANCE ───
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
  status          TEXT DEFAULT 'attended',
  UNIQUE (session_id, registration_id)
);

-- ─── 12. HIGH-PERFORMANCE INDEXES ───
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

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

CREATE INDEX IF NOT EXISTS idx_dbv_sr_no          ON db_vujis_records (sr_no);
CREATE INDEX IF NOT EXISTS idx_dbv_company        ON db_vujis_records (company_name);

CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_metadata_gin ON audit_log USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_op_req_by        ON operation_permissions (requested_by);
CREATE INDEX IF NOT EXISTS idx_op_status        ON operation_permissions (status);

CREATE INDEX IF NOT EXISTS idx_chat_users       ON chat_messages (user_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at  ON chat_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_reg_id      ON communications_log (registration_id);
CREATE INDEX IF NOT EXISTS idx_comm_status      ON communications_log (status);

CREATE INDEX IF NOT EXISTS idx_att_session      ON session_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_att_registration ON session_attendance (registration_id);

-- ─── 13. SEED INITIALIZATION ───
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Seed Default Admin Account (admin / buildcon2026)
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin',
  '$2a$12$TFLV90U1JcL4DU4iaw0yA.o.9CBQXTI1SDpbgDwpKb5lNzyQfScqi',
  'System Administrator',
  'admin'
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      name          = 'System Administrator',
      role          = 'admin';

-- ─── 14. EXPLICITLY DISABLE ROW LEVEL SECURITY (RLS) FOR SUPABASE ───
-- This ensures the Next.js CRM can freely interact with the database tables.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE travel_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE db_vujis_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE operation_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE communications_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendance DISABLE ROW LEVEL SECURITY;
