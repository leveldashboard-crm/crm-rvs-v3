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

-- Ensure task_phases columns exist on existing databases
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES task_batches(id) ON DELETE CASCADE;
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS task_id INTEGER;
ALTER TABLE task_phases ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS phase_number INTEGER DEFAULT 1;
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;




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

-- Ensure roster columns exist on existing databases
ALTER TABLE roster ADD COLUMN IF NOT EXISTS shift_start TIME;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS shift_end TIME;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS notes TEXT;



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

-- Ensure targets columns exist on existing databases
ALTER TABLE targets ADD COLUMN IF NOT EXISTS period_type TEXT;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS calls_target INTEGER DEFAULT 0;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS conversions_target INTEGER DEFAULT 0;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS notes TEXT;


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
    body TEXT,
    body_html TEXT,
    placeholders JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure email_templates columns exist on existing databases
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body TEXT;
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

-- Ensure email_logs columns exist on existing databases
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS template_name TEXT;


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



-- Seed Sample Registrations Raw Demo Data (20+ Records across domestic & export sectors)
INSERT INTO registrations (sr_no, first_name, last_name, country_name, company_name, participant_email, participant_mobile, status, main_import_product_1, main_import_product_2, poc, designation, company_website, flight_hotel_code, remarks)
VALUES
  (1001, 'Tariq', 'Al-Mansoor', 'UAE', 'Gulf Heavy Structures LLC', 'tariq@gulfheavy.ae', '+971501234567', 'Confirmed', 'Structural Steel Columns', 'Rebar Mesh', 'Caller Deepak', 'Managing Director', 'gulfheavy.ae', 'FH-902', 'High-priority buyer for Export Sector'),
  (1002, 'Rajesh', 'Sharma', 'India', 'Buildcon Infrastructure Ltd', 'r.sharma@buildconinfra.in', '+919876543210', 'In Progress', 'Cement & Ready Mix', 'Pipelining', 'Caller Koshti', 'Procurement Head', 'buildconinfra.in', 'FH-104', 'Needs follow-up call on 24th July'),
  (1003, 'Amina', 'Kassim', 'Kenya', 'Nairobi Urban Developers', 'amina@nairobiurban.co.ke', '+254712345678', 'Pending', 'Pre-cast Concrete Panels', 'Glass Facades', 'Caller Koshti', 'Operations Director', 'nairobiurban.co.ke', 'FH-301', 'Sent travel support letter'),
  (1004, 'Heinrich', 'Weber', 'Germany', 'Heidelberg Tech GMBH', 'h.weber@heidelbergtech.de', '+49301234567', 'Confirmed', 'Automated Crane Rigging', 'Tower Cranes', 'Caller Deepak', 'VP International Business', 'heidelbergtech.de', 'FH-889', 'VIP Speaker & Exhibitor'),
  (1005, 'Suresh', 'Patel', 'India', 'Gujarat Heavy Piping Corp', 'suresh@gujarathp.com', '+919825011223', 'Confirmed', 'HDPE Pipes', 'Valves & Fittings', 'Caller Koshti', 'Chief Purchasing Officer', 'gujarathp.com', 'FH-112', 'Flight booked for 26th Jan'),
  (1006, 'Fatima', 'Al-Zahra', 'Saudi Arabia', 'Riyadh Contracting Co', 'f.alzahra@riyadhcon.sa', '+966501112233', 'In Progress', 'Scaffolding Systems', 'Formwork Systems', 'Caller Deepak', 'Global Sourcing Manager', 'riyadhcon.sa', 'FH-405', 'Requested hotel suite'),
  (1007, 'Chen', 'Wei', 'China', 'Shanghai Excavator Works', 'chen.wei@shanghaiexc.cn', '+862168889999', 'Confirmed', 'Heavy Excavators', 'Hydraulic Pumps', 'Caller Deepak', 'Chief Trade Representative', 'shanghaiexc.cn', 'FH-701', 'Visa support document dispatched'),
  (1008, 'Vikram', 'Mehta', 'India', 'Delhi Smart City Developers', 'v.mehta@delhismartcity.org', '+919811098765', 'Confirmed', 'Smart Lighting Cables', 'Solar Grid Materials', 'Caller Koshti', 'Project Director', 'delhismartcity.org', 'FH-202', 'Confirmed attendance for Day 1 & Day 2'),
  (1009, 'Omar', 'Farooq', 'Qatar', 'Doha Sky Building Mat', 'omar@dohasky.qa', '+97444123456', 'Pending', 'Marble & Granite Slabs', 'Ceramic Tiles', 'Caller Deepak', 'General Manager', 'dohasky.qa', 'FH-509', 'Awaiting passport front copy'),
  (1010, 'Karan', 'Singh', 'Nepal', 'Kathmandu Infra Group', 'karan@ktminfra.np', '+9779851012345', 'In Progress', 'Bridge Girders', 'Steel Cables', 'Caller Koshti', 'Executive Director', 'ktminfra.np', 'FH-610', 'Scheduled call with Team Lead')
ON CONFLICT (sr_no) DO NOTHING;

-- Seed Sample Travel Desk Records
INSERT INTO travel_records (responses_sr_no, initial, first_name, last_name, country_name, country_code, participant_mobile, room_no, hotel_name, check_in_date, check_out_date, room_units, arrival_date, arrival_flight_no, arrival_to, arrival_time, departure_date, departure_flight_no, departure_from, departure_time, sector, company_name, poc, status, reimbursement, ticket_received, invoice_received, visa_received, voucher_received)
VALUES
  ('1001', 'Mr.', 'Tariq', 'Al-Mansoor', 'UAE', '+971', '+971501234567', '402', 'Taj Palace New Delhi', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'EK-510', 'DEL', '14:30', '2026-01-28', 'EK-511', 'DEL', '18:15', 'Export Sector', 'Gulf Heavy Structures LLC', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1002', 'Mr.', 'Rajesh', 'Sharma', 'India', '+91', '+919876543210', '215', 'The Leela Ambience', '2026-01-26', '2026-01-28', 1.0, '2026-01-26', 'AI-802', 'DEL', '09:15', '2026-01-28', 'AI-803', 'DEL', '20:45', 'Bharat Buildcon', 'Buildcon Infrastructure Ltd', 'Caller Koshti', 'In Progress', 'N/A', 'TRUE', 'FALSE', 'N/A', 'FALSE'),
  ('1004', 'Dr.', 'Heinrich', 'Weber', 'Germany', '+49', '+49301234567', '701', 'ITC Maurya New Delhi', '2026-01-24', '2026-01-29', 1.0, '2026-01-24', 'LH-760', 'DEL', '23:50', '2026-01-29', 'LH-761', 'DEL', '03:10', 'Export Sector', 'Heidelberg Tech GMBH', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1005', 'Mr.', 'Suresh', 'Patel', 'India', '+91', '+919825011223', '108', 'JW Marriott Aerocity', '2026-01-25', '2026-01-27', 1.0, '2026-01-25', '6E-451', 'DEL', '11:20', '2026-01-27', '6E-454', 'DEL', '16:40', 'Bharat Buildcon', 'Gujarat Heavy Piping Corp', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE')
ON CONFLICT DO NOTHING;


-- Seed Task Batches
INSERT INTO task_batches (id, name, sector, assigned_to_name, country, continent, status, completion_percent, total_delegates, completed_delegates)
VALUES
  (1, 'Export Calling Batch #1 - Middle East', 'Export Sector', 'Caller Deepak', 'UAE', 'Asia', 'in_progress', 65.00, 20, 13),
  (2, 'Domestic Buildcon Batch #4 - North India', 'Bharat Buildcon', 'Caller Koshti', 'India', 'Asia', 'in_progress', 40.00, 25, 10),
  (3, 'Heavy Machinery Buyers - Europe & East Asia', 'Heavy Machinery & Equipment', 'Team Lead', 'Germany', 'Europe', 'completed', 100.00, 15, 15)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for task_batches
SELECT setval('task_batches_id_seq', COALESCE((SELECT MAX(id) FROM task_batches), 1));

-- Seed Task Phases Checklist
INSERT INTO task_phases (batch_id, phase_number, name, description, is_completed)
VALUES
  (1, 1, 'Initial Delegate Outreach', 'Contact delegates via ISD phone call & introduce event agenda', true),
  (1, 2, 'Travel & Passport Verification', 'Verify passport validity & travel itinerary details', true),
  (1, 3, 'Flight Booking Confirmation', 'Confirm flight ticket details and issue booking link', true),
  (1, 4, 'Hotel Accommodation & Voucher', 'Assign hotel room unit & dispatch hotel voucher', false),
  (1, 5, 'Final Badge & Invitation Dispatched', 'Send final QR invitation badge to delegate', false),
  (2, 1, 'Initial Delegate Outreach', 'Contact domestic delegates for attendance confirmation', true),
  (2, 2, 'Company & Product Verification', 'Verify main import product category 1 & 2', true),
  (2, 3, 'Hotel & Travel Desk Logistics', 'Check hotel requirement and local transport', false)
ON CONFLICT DO NOTHING;



-- Seed Operational Roster
INSERT INTO roster (week, user_id, user_name, sector, country, shift_start, shift_end, effective_date, notes)
VALUES
  ('2026-W04', 4, 'Caller Koshti', 'Bharat Buildcon', 'India', '09:00:00', '18:00:00', '2026-01-20', 'Domestic Calling Window'),
  ('2026-W04', 5, 'Caller Deepak', 'Export Sector', 'UAE', '10:00:00', '19:00:00', '2026-01-20', 'GCC & Overseas Calling Window'),
  ('2026-W04', 3, 'Team Lead', 'Bharat Buildcon', 'India', '08:30:00', '17:30:00', '2026-01-20', 'Team Supervision & Escalations')
ON CONFLICT DO NOTHING;


-- Seed Targets Management
INSERT INTO targets (period, period_type, user_id, user_name, calls_target, conversions_target, start_date, end_date, notes)
VALUES
  ('2026-Q1', '3m', 4, 'Caller Koshti', 300, 45, '2026-01-01', '2026-03-31', 'Q1 Domestic Conversion Goal'),
  ('2026-Q1', '3m', 5, 'Caller Deepak', 350, 60, '2026-01-01', '2026-03-31', 'Q1 Export Conversion Goal'),
  ('2026-H1', '6m', 3, 'Team Lead', 1000, 180, '2026-01-01', '2026-06-30', 'H1 Overall Team Goal')
ON CONFLICT DO NOTHING;


-- Seed QA Scores
INSERT INTO qa_scores (call_log_id, auditor_id, auditor_name, caller_id, caller_name, script_adherence, tone, data_accuracy, customer_handling, overall_score, notes)
VALUES
  (101, 6, 'QA Auditor', 4, 'Caller Koshti', 4.50, 4.80, 4.20, 4.70, 4.55, 'Excellent call handling and polite tone.'),
  (102, 6, 'QA Auditor', 5, 'Caller Deepak', 4.80, 4.90, 4.70, 4.80, 4.80, 'Outstanding international delegate engagement and fast resolution.'),
  (103, 6, 'QA Auditor', 4, 'Caller Koshti', 4.00, 4.20, 3.90, 4.10, 4.05, 'Good adherence to script; remind delegate about hotel voucher.')
ON CONFLICT DO NOTHING;

-- Seed Team Chat & Group Messages
INSERT INTO chat_messages (user_id, recipient_id, thread_type, thread_id, message, created_at)
VALUES
  (1, NULL, 'team', 'bharat_buildcon_2026', 'Welcome to Team Chat! Project X messaging is live.', NOW() - INTERVAL '2 hours'),
  (3, NULL, 'team', 'bharat_buildcon_2026', 'Batch #1 Middle East is 65% completed. Great work @Caller Deepak!', NOW() - INTERVAL '1 hour'),
  (5, NULL, 'group', '1', 'Export Sector calling is active. Gulf Heavy Structures LLC has confirmed attendance!', NOW() - INTERVAL '45 minutes'),
  (4, 1, 'direct', NULL, 'Hi Admin, please verify hotel voucher allocation for Sr No 1002.', NOW() - INTERVAL '30 minutes'),
  (1, 4, 'direct', NULL, 'Hotel voucher for Sr No 1002 has been verified and dispatched.', NOW() - INTERVAL '15 minutes')
ON CONFLICT DO NOTHING;

-- Seed Notifications
INSERT INTO notifications (target_user_id, source_user_id, type, title, message, priority, read)
VALUES
  (4, 1, 'task_assigned', 'New Task Batch Assigned', 'You have been assigned Domestic Buildcon Batch #4 (25 delegates).', 'normal', false),
  (5, 3, 'call_escalation', 'High-Priority Overseas Buyer', 'Tariq Al-Mansoor (UAE) requested callback regarding hotel suite reservation.', 'high', false),
  (4, 6, 'qa_score', 'QA Audit Score Published', 'Your call audit score for Call #101 is 4.55/5.00.', 'normal', true)
ON CONFLICT DO NOTHING;

-- Seed Email Logs
INSERT INTO email_logs (sender_id, recipient_email, recipient_name, template_name, subject, body, status)
VALUES
  (1, 'tariq@gulfheavy.ae', 'Tariq Al-Mansoor', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Tariq Al-Mansoor, We invite Gulf Heavy Structures LLC to Bharat Buildcon 2026.', 'sent'),
  (1, 'h.weber@heidelbergtech.de', 'Heinrich Weber', 'visa_support', 'Visa Support Document — Bharat Buildcon 2026', 'Dear Heinrich Weber, Attached is your visa support letter.', 'sent'),
  (2, 'amina@nairobiurban.co.ke', 'Amina Kassim', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Amina Kassim, We invite Nairobi Urban Developers to Bharat Buildcon 2026.', 'queued')
ON CONFLICT DO NOTHING;


-- Seed Operation Logs
INSERT INTO operation_logs (user_id, user_name, user_role, action, entity_type, entity_id, status)
VALUES
  (1, 'Master Admin', 'admin', 'system_init', 'database', 1, 'success'),
  (1, 'Master Admin', 'admin', 'batch_allocation', 'task_batch', 1, 'success'),
  (5, 'Caller Deepak', 'caller', 'registration_update', 'registration', 1001, 'success'),
  (6, 'QA Auditor', 'qa_auditor', 'qa_score_submitted', 'qa_score', 101, 'success')
ON CONFLICT DO NOTHING;

-- Seed Sample App Settings
INSERT INTO app_settings (id, event_id, event_name, session_timeout_minutes, feature_flag_ai_scoring, notifications_enabled)
VALUES (1, 'bharat_buildcon_2026', 'Bharat Buildcon 2026', 30, true, true)
ON CONFLICT DO NOTHING;

COMMIT;

