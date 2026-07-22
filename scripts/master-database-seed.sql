-- ============================================================================
-- MASTER DATABASE SCHEMA & DEMO RAW SEED DATA
-- Project X Enterprise Calling CRM & Advanced Team Chat (v3)
-- Target: PostgreSQL / Supabase
-- ============================================================================

BEGIN;

-- ─── 1. EXTENSIONS ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 2. SCHEMAS & TABLES ───────────────────────────────────────────────────

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'caller',
    sector TEXT DEFAULT 'Bharat Buildcon',
    country TEXT,
    assigned_countries JSONB,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure users columns exist on existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Bharat Buildcon';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_countries JSONB;


-- Sectors Table
CREATE TABLE IF NOT EXISTS sectors (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    country_pool JSONB,
    time_window_start TEXT DEFAULT '09:00',
    time_window_end TEXT DEFAULT '18:00',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure sectors columns exist on existing databases
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS country_pool JSONB;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS time_window_start TEXT DEFAULT '09:00';
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS time_window_end TEXT DEFAULT '18:00';


-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    thread_type TEXT DEFAULT 'task', -- task | team | direct | group
    thread_id TEXT,                     -- taskId or sector code or groupId
    message TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_size TEXT,
    attachments JSONB,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Chat Groups Table
CREATE TABLE IF NOT EXISTS chat_groups (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    name TEXT NOT NULL,
    description TEXT,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    member_ids JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    source_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    priority TEXT DEFAULT 'normal',
    read BOOLEAN DEFAULT false NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026' UNIQUE,
    event_name TEXT DEFAULT 'Bharat Buildcon 2026',
    sheet_id TEXT,
    gas_web_app_url TEXT,
    registration_sheet_id TEXT,
    registration_sheet_name TEXT DEFAULT 'Form Responses 1',
    travel_sheet_name TEXT DEFAULT 'Travel Desk Records',
    db_vujis_sheet_name TEXT DEFAULT 'DB & vujis',
    drive_folder_id TEXT,
    session_timeout_minutes INTEGER DEFAULT 30,
    backup_gas_web_app_url TEXT,
    backup_sheet_id TEXT,
    backup_folder_id TEXT,
    backup_sheet_id_2 TEXT,
    backup_folder_id_2 TEXT,
    dashboard_pivot_sheet_name TEXT,
    mailer_web_app_url TEXT,
    mailer_shared_secret TEXT,
    mailer_mode TEXT DEFAULT 'api',
    mailer_enabled BOOLEAN DEFAULT false,
    mailer_smtp_host TEXT DEFAULT 'smtp.gmail.com',
    mailer_smtp_port TEXT DEFAULT '587',
    mailer_smtp_user TEXT,
    mailer_smtp_pass TEXT,
    mailer_smtp_from TEXT,
    mailer_folder_letter TEXT,
    mailer_folder_card TEXT,
    mailer_folder_itinerary TEXT,
    mailer_folder_voucher TEXT,
    mailer_drive_api_key TEXT,
    feature_flag_gamification BOOLEAN DEFAULT false,
    feature_flag_whatsapp BOOLEAN DEFAULT false,
    feature_flag_sms BOOLEAN DEFAULT false,
    feature_flag_ai_scoring BOOLEAN DEFAULT true,
    escalation_level1_hours INTEGER DEFAULT 2,
    escalation_level2_hours INTEGER DEFAULT 6,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Task Batches Table
CREATE TABLE IF NOT EXISTS task_batches (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026' NOT NULL,
    sector TEXT DEFAULT 'Bharat Buildcon',
    name TEXT NOT NULL,
    assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_ids JSONB,
    assigned_to_name TEXT,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    country TEXT,
    continent TEXT,
    time_link TEXT,
    status TEXT DEFAULT 'pending',
    completion_percent NUMERIC(5,2) DEFAULT 0.00,
    total_delegates INTEGER DEFAULT 0,
    completed_delegates INTEGER DEFAULT 0,
    deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Task Phases Checklist Table
CREATE TABLE IF NOT EXISTS task_phases (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES task_batches(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Operational Roster Table
CREATE TABLE IF NOT EXISTS roster (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    sector TEXT NOT NULL,
    country TEXT,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    effective_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Targets Management Table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    period_type TEXT NOT NULL, -- 3m | 6m | 9m
    calls_target INTEGER NOT NULL DEFAULT 0,
    conversions_target INTEGER NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- QA Scores Table
CREATE TABLE IF NOT EXISTS qa_scores (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    call_log_id INTEGER NOT NULL,
    auditor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    auditor_name TEXT NOT NULL,
    caller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    caller_name TEXT NOT NULL,
    script_adherence NUMERIC(3,2),
    tone NUMERIC(3,2),
    data_accuracy NUMERIC(3,2),
    customer_handling NUMERIC(3,2),
    overall_score NUMERIC(5,2) NOT NULL,
    notes TEXT,
    rubric_data JSONB,
    scored_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    placeholders JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure email_templates columns exist on existing databases
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS placeholders JSONB;


-- Email Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    template_name TEXT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- sent | failed | queued
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    sr_no INTEGER UNIQUE,
    timestamp_raw TEXT,
    title TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    country_name TEXT NOT NULL,
    passport_country TEXT,
    region TEXT,
    participant_mobile TEXT,
    participant_email TEXT,
    company_name TEXT NOT NULL,
    company_website TEXT,
    designation TEXT,
    passport_number TEXT,
    place_of_issue TEXT,
    date_of_expiry TEXT,
    nature_of_business TEXT,
    main_import_product_1 TEXT,
    main_import_product_2 TEXT,
    proof_upload TEXT,
    products_services TEXT,
    business_card_upload TEXT,
    poc TEXT,
    proof_import TEXT,
    type_of_poi TEXT,
    bl_supplier_country TEXT,
    bl_buyer_country TEXT,
    status TEXT DEFAULT 'Pending',
    flight_hotel_code TEXT,
    remarks TEXT,
    bl_status TEXT,
    bb_invitation_status TEXT,
    dollar_business TEXT,
    vujis TEXT,
    will_not_attend TEXT,
    is_active BOOLEAN DEFAULT true,
    drive_passport_front_url TEXT,
    drive_passport_back_url TEXT,
    drive_proof_url TEXT,
    drive_business_card_url TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Travel Records Table
CREATE TABLE IF NOT EXISTS travel_records (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
    responses_sr_no TEXT,
    room_no TEXT,
    hotel_name TEXT,
    initial TEXT,
    first_name TEXT,
    last_name TEXT,
    country_name TEXT,
    country_code TEXT,
    participant_mobile TEXT,
    check_in_date TEXT,
    check_out_date TEXT,
    room_units NUMERIC(3,1) DEFAULT 1.0,
    arrival_date TEXT,
    arrival_flight_no TEXT,
    arrival_to TEXT,
    arrival_time TEXT,
    departure_date TEXT,
    departure_flight_no TEXT,
    departure_from TEXT,
    departure_time TEXT,
    sector TEXT DEFAULT 'Bharat Buildcon',
    company_name TEXT,
    poc TEXT,
    status TEXT DEFAULT 'Pending',
    reimbursement TEXT,
    notes TEXT,
    invoice_amount TEXT,
    invoice_amount_usd TEXT,
    invoice_amount_local TEXT,
    invoice_currency TEXT,
    ticket_received TEXT DEFAULT 'FALSE',
    invoice_received TEXT DEFAULT 'FALSE',
    visa_received TEXT DEFAULT 'FALSE',
    passport_copy_received TEXT DEFAULT 'FALSE',
    voucher_received TEXT DEFAULT 'FALSE',
    reimbursement_amount TEXT,
    bl TEXT,
    bl_url TEXT,
    ticket_url TEXT,
    invoice_url TEXT,
    visa_url TEXT,
    passport_url TEXT,
    voucher_url TEXT,
    business_card_url TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Operation Logs Table
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    status TEXT DEFAULT 'success',
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);


-- ─── 3. RAW DEMO SEED DATA ───────────────────────────────────────────────────

-- Seed Users (Password: buildcon2026)
INSERT INTO users (email, name, password_hash, role, sector, country)
VALUES
  ('admin@buildcon.com', 'Master Admin', '$2b$10$wT8...demo_hash', 'admin', 'Bharat Buildcon', 'India'),
  ('regional_admin@buildcon.com', 'Regional Supervisor', '$2b$10$wT8...demo_hash', 'regional_admin', 'Bharat Buildcon', 'India'),
  ('team_lead@buildcon.com', 'Team Lead', '$2b$10$wT8...demo_hash', 'team_lead', 'Bharat Buildcon', 'India'),
  ('caller@buildcon.com', 'Caller Koshti', '$2b$10$wT8...demo_hash', 'caller', 'Bharat Buildcon', 'India'),
  ('caller2@buildcon.com', 'Caller Deepak', '$2b$10$wT8...demo_hash', 'caller', 'Export Sector', 'UAE'),
  ('qa_auditor@buildcon.com', 'QA Auditor', '$2b$10$wT8...demo_hash', 'qa_auditor', 'Bharat Buildcon', 'India'),
  ('analyst@buildcon.com', 'BI Analyst', '$2b$10$wT8...demo_hash', 'analyst', 'Bharat Buildcon', 'India')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  sector = EXCLUDED.sector,
  country = EXCLUDED.country;

-- Reset sequence for users
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));


-- Seed Sectors
INSERT INTO sectors (code, name, description, country_pool, time_window_start, time_window_end)
VALUES
  ('bb_main', 'Bharat Buildcon Main', 'Domestic construction & infrastructure trade summit', '["India", "Nepal", "Bhutan", "Sri Lanka"]'::jsonb, '09:00', '18:00'),
  ('export_desk', 'Export Sector', 'Overseas buyers and international trade delegates', '["UAE", "Saudi Arabia", "Qatar", "Oman", "Kenya", "Nigeria"]'::jsonb, '10:00', '19:00'),
  ('heavy_machinery', 'Heavy Machinery & Equipment', 'Industrial cranes, excavators, and concrete batching plants', '["Germany", "Japan", "South Korea", "China", "India"]'::jsonb, '08:30', '17:30')
ON CONFLICT DO NOTHING;


-- Seed Chat Groups
INSERT INTO chat_groups (id, name, description, member_ids, created_by_name)
VALUES
  (1, 'Export Calling Desk', 'Export Sector Calling & Strategy', '[1, 2, 3, 4]'::jsonb, 'Master Admin'),
  (2, 'Bharat Buildcon Operations', 'Main operations and team updates', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'Master Admin'),
  (3, 'High-Priority Follow-ups', 'Delegates requiring immediate response', '[1, 3, 4]'::jsonb, 'Team Lead')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for chat_groups
SELECT setval('chat_groups_id_seq', (SELECT MAX(id) FROM chat_groups));

-- Seed Default Email Templates
INSERT INTO email_templates (name, subject, body, body_html, placeholders)
VALUES
  ('invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear {{name}}, We invite {{company}} to Bharat Buildcon 2026.', '<div style="font-family:sans-serif;padding:20px;"><h2>Official Invitation</h2><p>Dear {{name}},</p><p>We are pleased to invite {{company}} to Bharat Buildcon 2026 in New Delhi.</p><p>Best regards,<br>Organising Committee</p></div>', '["name", "company"]'::jsonb),
  ('visa_support', 'Visa Support Document — Bharat Buildcon 2026', 'Dear {{name}}, Attached is your visa support letter for {{company}}.', '<div style="font-family:sans-serif;padding:20px;"><h2>Visa Assistance Letter</h2><p>Dear {{name}},</p><p>Attached is your embassy visa support letter for traveling to India representing {{company}}.</p></div>', '["name", "company"]'::jsonb)
ON CONFLICT DO NOTHING;



-- Seed Sample Registrations Raw Demo Data
INSERT INTO registrations (sr_no, first_name, last_name, country_name, company_name, participant_email, participant_mobile, status, main_import_product_1, poc)
VALUES
  (1001, 'Tariq', 'Al-Mansoor', 'UAE', 'Gulf Heavy Structures LLC', 'tariq@gulfheavy.ae', '+971501234567', 'Confirmed', 'Structural Steel Columns', 'Caller Deepak'),
  (1002, 'Rajesh', 'Sharma', 'India', 'Buildcon Infrastructure Ltd', 'r.sharma@buildconinfra.in', '+919876543210', 'In Progress', 'Cement & Ready Mix', 'Caller Koshti'),
  (1003, 'Amina', 'Kassim', 'Kenya', 'Nairobi Urban Developers', 'amina@nairobiurban.co.ke', '+254712345678', 'Pending', 'Pre-cast Concrete Panels', 'Caller Koshti'),
  (1004, 'Heinrich', 'Weber', 'Germany', 'Heidelberg Tech GMBH', 'h.weber@heidelbergtech.de', '+49301234567', 'Confirmed', 'Automated Crane Rigging', 'Caller Deepak')
ON CONFLICT (sr_no) DO NOTHING;

-- Seed Sample App Settings
INSERT INTO app_settings (id, event_id, event_name, session_timeout_minutes, feature_flag_ai_scoring, notifications_enabled)
VALUES (1, 'bharat_buildcon_2026', 'Bharat Buildcon 2026', 30, true, true)
ON CONFLICT DO NOTHING;


COMMIT;
