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
    week TEXT,
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
ALTER TABLE roster ADD COLUMN IF NOT EXISTS week TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS shift_start TIME;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS shift_end TIME;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS notes TEXT;



-- Targets Management Table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    event_id TEXT DEFAULT 'bharat_buildcon_2026',
    period TEXT,
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
ALTER TABLE targets ADD COLUMN IF NOT EXISTS period TEXT;
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
    body TEXT,
    status TEXT NOT NULL, -- sent | failed | queued
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure email_logs columns exist on existing databases
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS body TEXT;
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
INSERT INTO users (email, name, password_hash, role, sector, country, assigned_countries)
VALUES
  ('admin@buildcon.com', 'Master Admin', '$2b$10$wT8...demo_hash', 'admin', 'Bharat Buildcon', 'India', '["India", "UAE", "Saudi Arabia", "Germany", "USA", "UK", "Japan", "Kenya", "Nigeria", "Brazil"]'::jsonb),
  ('regional_admin@buildcon.com', 'Regional Supervisor', '$2b$10$wT8...demo_hash', 'regional_admin', 'Bharat Buildcon', 'India', '["India", "Nepal", "Bhutan", "Sri Lanka", "Bangladesh", "UAE", "Qatar", "Oman"]'::jsonb),
  ('team_lead@buildcon.com', 'Team Lead', '$2b$10$wT8...demo_hash', 'team_lead', 'Bharat Buildcon', 'India', '["Germany", "Japan", "South Korea", "China", "Singapore", "Australia", "Canada", "France"]'::jsonb),
  ('caller@buildcon.com', 'Caller Koshti', '$2b$10$wT8...demo_hash', 'caller', 'Bharat Buildcon', 'India', '["India", "Nepal", "Bhutan", "Sri Lanka", "Bangladesh", "Thailand", "Vietnam", "Malaysia", "Singapore", "Indonesia"]'::jsonb),
  ('caller2@buildcon.com', 'Caller Deepak', '$2b$10$wT8...demo_hash', 'caller', 'Export Sector', 'UAE', '["UAE", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "Kenya", "Nigeria", "South Africa", "Egypt"]'::jsonb),
  ('qa_auditor@buildcon.com', 'QA Auditor', '$2b$10$wT8...demo_hash', 'qa_auditor', 'Bharat Buildcon', 'India', '["India", "UAE", "Germany"]'::jsonb),
  ('analyst@buildcon.com', 'BI Analyst', '$2b$10$wT8...demo_hash', 'analyst', 'Bharat Buildcon', 'India', '["India", "USA", "UK", "China"]'::jsonb)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  sector = EXCLUDED.sector,
  country = EXCLUDED.country,
  assigned_countries = EXCLUDED.assigned_countries;

-- Reset sequence for users
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));


-- Seed Sectors
INSERT INTO sectors (code, name, description, country_pool, time_window_start, time_window_end)
VALUES
  ('bb_main', 'Bharat Buildcon Main', 'Domestic construction & infrastructure trade summit', '["India", "Nepal", "Bhutan", "Sri Lanka", "Bangladesh", "Thailand", "Vietnam", "Malaysia", "Singapore", "Indonesia"]'::jsonb, '09:00', '18:00'),
  ('export_desk', 'Export Sector', 'Overseas buyers and international trade delegates', '["UAE", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "Kenya", "Nigeria", "South Africa", "Egypt", "Ghana", "Tanzania"]'::jsonb, '10:00', '19:00'),
  ('heavy_machinery', 'Heavy Machinery & Equipment', 'Industrial cranes, excavators, and concrete batching plants', '["Germany", "Japan", "South Korea", "China", "USA", "UK", "Australia", "Canada", "Italy", "France", "Spain", "Netherlands"]'::jsonb, '08:30', '17:30')
ON CONFLICT DO NOTHING;


-- Seed Chat Groups
INSERT INTO chat_groups (id, name, description, member_ids, created_by_name)
VALUES
  (1, 'Export Calling Desk', 'Export Sector Calling & Strategy', '[1, 2, 3, 4]'::jsonb, 'Master Admin'),
  (2, 'Bharat Buildcon Operations', 'Main operations and team updates', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'Master Admin'),
  (3, 'High-Priority Follow-ups', 'Delegates requiring immediate response', '[1, 3, 4]'::jsonb, 'Team Lead')
ON CONFLICT DO NOTHING;

-- Reset sequence for chat_groups
SELECT setval('chat_groups_id_seq', (SELECT MAX(id) FROM chat_groups));

-- Seed Default Email Templates
INSERT INTO email_templates (name, subject, body, body_html, placeholders)
VALUES
  ('invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear {{name}}, We invite {{company}} to Bharat Buildcon 2026.', '<div style="font-family:sans-serif;padding:20px;"><h2>Official Invitation</h2><p>Dear {{name}},</p><p>We are pleased to invite {{company}} to Bharat Buildcon 2026 in New Delhi.</p><p>Best regards,<br>Organising Committee</p></div>', '["name", "company"]'::jsonb),
  ('visa_support', 'Visa Support Document — Bharat Buildcon 2026', 'Dear {{name}}, Attached is your visa support letter for {{company}}.', '<div style="font-family:sans-serif;padding:20px;"><h2>Visa Assistance Letter</h2><p>Dear {{name}},</p><p>Attached is your embassy visa support letter for traveling to India representing {{company}}.</p></div>', '["name", "company"]'::jsonb)
ON CONFLICT DO NOTHING;



-- Seed Sample Registrations Raw Demo Data (50 Delegates across 50 Countries for Pitching CRM)
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
  (1010, 'Karan', 'Singh', 'Nepal', 'Kathmandu Infra Group', 'karan@ktminfra.np', '+9779851012345', 'In Progress', 'Bridge Girders', 'Steel Cables', 'Caller Koshti', 'Executive Director', 'ktminfra.np', 'FH-610', 'Scheduled call with Team Lead'),
  (1011, 'Kenji', 'Takahashi', 'Japan', 'Tokyo Heavy Machinery Corp', 'k.takahashi@tokyomach.jp', '+81335550199', 'Confirmed', 'Robotic Welding Arms', 'Industrial Automation', 'Team Lead', 'Chief Technology Officer', 'tokyomach.jp', 'FH-771', 'Keynote speaker on Day 1'),
  (1012, 'Robert', 'Miller', 'USA', 'American Infrastructure Co', 'r.miller@usinfra.com', '+12125550144', 'Confirmed', 'Asphalt Paving Rig', 'Road Rollers', 'Team Lead', 'VP Strategic Procurement', 'usinfra.com', 'FH-812', 'Seeking joint venture partners'),
  (1013, 'James', 'Wilson', 'UK', 'London Bridge Engineering', 'j.wilson@londonbridge.uk', '+442079460123', 'In Progress', 'Architectural Glass', 'Steel Truss Systems', 'Master Admin', 'Principal Partner', 'londonbridge.uk', 'FH-933', 'Requested 1-on-1 buyer meeting'),
  (1014, 'Carlos', 'Silva', 'Brazil', 'Sao Paulo Heavy Constr', 'carlos@saopaulohc.br', '+5511987654321', 'Pending', 'Earthmoving Bulldozers', 'Crusher Machines', 'Caller Deepak', 'Sourcing Lead', 'saopaulohc.br', 'FH-414', 'Inquired about visa assistance'),
  (1015, 'Tenzin', 'Norbu', 'Bhutan', 'Thimphu Eco Infra Corp', 'norbu@thimphueco.bt', '+97517123456', 'Confirmed', 'Timber Framing', 'Solar Roof Panels', 'Caller Koshti', 'Managing Director', 'thimphueco.bt', 'FH-115', 'Attending with 3 delegates'),
  (1016, 'Nimal', 'Perera', 'Sri Lanka', 'Colombo Port Developers', 'nimal@colomboport.lk', '+94112345678', 'In Progress', 'Dredging Equipment', 'Marine Steel Sheets', 'Caller Koshti', 'Head of Marine Eng', 'colomboport.lk', 'FH-216', 'Flight arrival confirmed'),
  (1017, 'Rahim', 'Uddin', 'Bangladesh', 'Dhaka Skyline Builders', 'rahim@dhakasky.bd', '+8801711223344', 'Confirmed', 'AAC Concrete Blocks', 'Thermal Insulation', 'Caller Koshti', 'CEO', 'dhakasky.bd', 'FH-317', 'Hotel room allocated'),
  (1018, 'Somchai', 'Jaidee', 'Thailand', 'Bangkok Modular Homes', 'somchai@bkkmodular.th', '+6621234567', 'Pending', 'Prefabricated Cabins', 'Composite Panels', 'Caller Koshti', 'General Manager', 'bkkmodular.th', 'FH-418', 'Interested in export dealership'),
  (1019, 'Nguyen', 'Van', 'Vietnam', 'Hanoi Smart Towers', 'nguyen.van@hanoismart.vn', '+842438889999', 'In Progress', 'Elevator Systems', 'HVAC Chillers', 'Caller Koshti', 'Project Manager', 'hanoismart.vn', 'FH-519', 'Sent product catalog'),
  (1020, 'Ahmad', 'Zaki', 'Malaysia', 'KL Structural Steel', 'zaki@klstructural.my', '+60321112222', 'Confirmed', 'Galvanized Beams', 'Decking Sheets', 'Caller Koshti', 'Procurement Director', 'klstructural.my', 'FH-620', 'Confirmed 3-day pass'),
  (1021, 'David', 'Lim', 'Singapore', 'Singa Urban Solutions', 'david.lim@singaurban.sg', '+6567890123', 'Confirmed', 'Smart Building IoT', 'BMS Controls', 'Caller Koshti', 'Chief Innovation Officer', 'singaurban.sg', 'FH-721', 'VIP Lounge access requested'),
  (1022, 'Budi', 'Santoso', 'Indonesia', 'Jakarta Harbour Construction', 'budi@jakartaharbour.id', '+62215556677', 'In Progress', 'Piling Foundations', 'Geo-textile Fabrics', 'Caller Koshti', 'Technical Director', 'jakartaharbour.id', 'FH-822', 'Requested trade meeting'),
  (1023, 'Fahad', 'Al-Sabah', 'Kuwait', 'Kuwait National Buildcon', 'f.sabah@kuwaitbuild.kw', '+96522334455', 'Confirmed', 'Bitumen Membrane', 'Waterproofing Paints', 'Caller Deepak', 'Chairman', 'kuwaitbuild.kw', 'FH-923', 'VIP Suite booked'),
  (1024, 'Youssef', 'Al-Khalifa', 'Bahrain', 'Manama Towers Est', 'youssef@manamatowers.bh', '+97317555666', 'Pending', 'Aluminum Extrusions', 'Curtain Walls', 'Caller Deepak', 'Procurement Officer', 'manamatowers.bh', 'FH-124', 'Awaiting flight details'),
  (1025, 'Nelson', 'Mandela Jr', 'South Africa', 'Cape Infrastructure Trust', 'nelson@capeinfra.co.za', '+27214001234', 'Confirmed', 'Mining Conveyor Belts', 'Crusher Parts', 'Caller Deepak', 'Director', 'capeinfra.co.za', 'FH-225', 'Confirmed booth visit'),
  (1026, 'Khaled', 'El-Sayed', 'Egypt', 'Nile Delta Contracting', 'khaled@niledelta.eg', '+20227940000', 'In Progress', 'Granite Blocks', 'Irrigation Pipes', 'Caller Deepak', 'Managing Partner', 'niledelta.eg', 'FH-326', 'Follow-up call on 25th'),
  (1027, 'Kwame', 'Mensah', 'Ghana', 'Accra Metro Development', 'kwame@accrametro.gh', '+233302123456', 'Confirmed', 'Road Signs & Signals', 'Asphalt Additives', 'Caller Deepak', 'Chief Engineer', 'accrametro.gh', 'FH-427', 'Hotel booked'),
  (1028, 'Joseph', 'Mweru', 'Tanzania', 'Dar Es Salaam Heavy Material', 'mweru@dardev.tz', '+255222111222', 'Pending', 'Scaffolding Couplers', 'Safety Netting', 'Caller Deepak', 'Purchasing Agent', 'dardev.tz', 'FH-528', 'Sent invitation badge'),
  (1029, 'Bekele', 'Tadesse', 'Ethiopia', 'Addis Eco Building', 'bekele@addiseco.et', '+251115511223', 'In Progress', 'Clay Roof Tiles', 'Bamboo Flooring', 'Caller Deepak', 'General Manager', 'addiseco.et', 'FH-629', 'Checking flight options'),
  (1030, 'Gonzalo', 'Rojas', 'Chile', 'Santiago Mining Construction', 'gonzalo@santiagomining.cl', '+56229400100', 'Confirmed', 'Heavy Dump Truck Tires', 'Hydraulic Hoses', 'Master Admin', 'Procurement VP', 'santiagomining.cl', 'FH-730', 'Confirmed VIP guest'),
  (1031, 'Mateo', 'Gomez', 'Colombia', 'Bogota Infrastructure SA', 'mateo@bogotainfra.co', '+5717440099', 'Pending', 'Concrete Mixers', 'Vibrators', 'Master Admin', 'Operations Head', 'bogotainfra.co', 'FH-831', 'Follow-up email sent'),
  (1032, 'Alejandro', 'Fernandez', 'Argentina', 'Buenos Aires Civil Works', 'alejandro@bacivil.ar', '+541143210000', 'In Progress', 'Steel Rebar 12mm', 'Wire Rods', 'Master Admin', 'Purchasing Manager', 'bacivil.ar', 'FH-932', 'Passport copy uploaded'),
  (1033, 'Jan', 'De Jong', 'Netherlands', 'Amsterdam Port Heavy Tech', 'jan@amsterdamport.nl', '+31205550011', 'Confirmed', 'Port Cranes', 'Container Handlers', 'Team Lead', 'Managing Director', 'amsterdamport.nl', 'FH-133', 'Attending panel discussion'),
  (1034, 'Luc', 'Peeters', 'Belgium', 'Brussels Eco Concrete', 'luc@brusselseco.be', '+3225110022', 'Confirmed', 'Recycled Aggregates', 'Cement Fly Ash', 'Team Lead', 'Chief Sustainability Officer', 'brusselseco.be', 'FH-234', 'Hotel confirmed'),
  (1035, 'Erik', 'Lindqvist', 'Sweden', 'Stockholm Modular Systems', 'erik@stockholmmodular.se', '+4685550033', 'In Progress', 'Cross Laminated Timber', 'Insulated Panels', 'Team Lead', 'Head of R&D', 'stockholmmodular.se', 'FH-335', 'Requested tech demo'),
  (1036, 'Marc', 'Schneider', 'Switzerland', 'Zurich Precision Tools GMBH', 'marc@zurichprecision.ch', '+41442110044', 'Confirmed', 'Laser Distance Meters', 'Total Stations', 'Team Lead', 'Global Sales Director', 'zurichprecision.ch', 'FH-436', 'Exhibitor booth reserved'),
  (1037, 'Piotr', 'Kowalski', 'Poland', 'Warsaw Structural Steel SP', 'piotr@warsawsteel.pl', '+48226000055', 'Pending', 'H-Beams', 'Angle Iron', 'Team Lead', 'Procurement Director', 'warsawsteel.pl', 'FH-537', 'Awaiting confirmation'),
  (1038, 'Pavel', 'Novak', 'Czech Republic', 'Prague Machinery Works', 'pavel@praguemach.cz', '+420221000066', 'In Progress', 'CNC Lathe Machines', 'Milling Cutters', 'Team Lead', 'Plant Manager', 'praguemach.cz', 'FH-638', 'Sent trade profile'),
  (1039, 'Stefan', 'Gruber', 'Austria', 'Vienna Alpine Building', 'stefan@viennaalpine.at', '+4315000077', 'Confirmed', 'Tunnel Boring Machines', 'Rock Bolts', 'Team Lead', 'Project Director', 'viennaalpine.at', 'FH-739', 'Flight confirmed'),
  (1040, 'Nikos', 'Papadopoulos', 'Greece', 'Athens Marble & Stone', 'nikos@athensstone.gr', '+302103000088', 'In Progress', 'White Pentelikon Marble', 'Travertine', 'Team Lead', 'Managing Director', 'athensstone.gr', 'FH-840', 'Requested booth space'),
  (1041, 'Andrei', 'Popescu', 'Romania', 'Bucharest Heavy Equip SRL', 'andrei@bucharestequip.ro', '+40213000099', 'Pending', 'Road Graders', 'Compactor Rollers', 'Team Lead', 'Purchasing Agent', 'bucharestequip.ro', 'FH-941', 'Sent brochure'),
  (1042, 'Juan', 'Reyes', 'Philippines', 'Manila Bay Construction', 'juan@manilabaycon.ph', '+63285550100', 'Confirmed', 'Dredging Pipes', 'Sheet Piles', 'Caller Koshti', 'VP Sourcing', 'manilabaycon.ph', 'FH-142', 'Hotel suite assigned'),
  (1043, 'Tariq', 'Khan', 'Pakistan', 'Lahore Steel Mills Corp', 'tariq@lahoresteel.pk', '+924235550111', 'In Progress', 'Billet Steel', 'Sponge Iron', 'Caller Koshti', 'General Manager', 'lahoresteel.pk', 'FH-243', 'Follow-up call on 23rd'),
  (1044, 'Ali', 'Nurmatov', 'Kazakhstan', 'Astana Heavy Infra', 'ali@astanahc.kz', '+77172550122', 'Confirmed', 'Pipeline Valves', 'Gas Compressors', 'Caller Deepak', 'CEO', 'astanahc.kz', 'FH-344', 'Confirmed VIP guest'),
  (1045, 'Sardor', 'Karimov', 'Uzbekistan', 'Tashkent Urban Dev', 'sardor@tashkenturban.uz', '+998712550133', 'Pending', 'Roofing Shingles', 'Plywood Panels', 'Caller Deepak', 'Import Director', 'tashkenturban.uz', 'FH-445', 'Awaiting passport front'),
  (1046, 'Liam', 'O’Connor', 'Australia', 'Sydney Harbour Heavy Engineering', 'liam@sydneyheavy.au', '+61292000144', 'Confirmed', 'Piling Hammers', 'Tower Crane Jibs', 'Team Lead', 'Chief Operating Officer', 'sydneyheavy.au', 'FH-546', 'Keynote panel panelist'),
  (1047, 'Ethan', 'Tremblay', 'Canada', 'Toronto Heavy Mining Corp', 'ethan@torontomining.ca', '+14165550155', 'Confirmed', 'Underground Loaders', 'Ventilation Fans', 'Team Lead', 'VP Supply Chain', 'torontomining.ca', 'FH-647', 'Hotel booked at Taj'),
  (1048, 'Mateo', 'Hernandez', 'Mexico', 'Guadalajara Concrete SA', 'mateo@guadalajaraconcrete.mx', '+523338000166', 'In Progress', 'Transit Mixers', 'Batching Plants', 'Master Admin', 'Director of Operations', 'guadalajaraconcrete.mx', 'FH-748', 'Sent product specs'),
  (1049, 'Dimitri', 'Rossi', 'Italy', 'Milan Heavy Steel SRL', 'dimitri@milansteel.it', '+390280000177', 'Confirmed', 'Stainless Steel Plates', 'Seamless Pipes', 'Team Lead', 'Export Sales Manager', -- Seed Sample Travel Desk Records (Comprehensive list covering Taj Palace, The Leela, ITC Maurya, JW Marriott)
INSERT INTO travel_records (responses_sr_no, initial, first_name, last_name, country_name, country_code, participant_mobile, room_no, hotel_name, check_in_date, check_out_date, room_units, arrival_date, arrival_flight_no, arrival_to, arrival_time, departure_date, departure_flight_no, departure_from, departure_time, sector, company_name, poc, status, reimbursement, ticket_received, invoice_received, visa_received, voucher_received)
VALUES
  ('1001', 'Mr.', 'Tariq', 'Al-Mansoor', 'UAE', '+971', '+971501234567', '402', 'Taj Palace New Delhi', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'EK-510', 'DEL', '14:30', '2026-01-28', 'EK-511', 'DEL', '18:15', 'Export Sector', 'Gulf Heavy Structures LLC', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1002', 'Mr.', 'Rajesh', 'Sharma', 'India', '+91', '+919876543210', '215', 'The Leela Ambience', '2026-01-26', '2026-01-28', 1.0, '2026-01-26', 'AI-802', 'DEL', '09:15', '2026-01-28', 'AI-803', 'DEL', '20:45', 'Bharat Buildcon', 'Buildcon Infrastructure Ltd', 'Caller Koshti', 'In Progress', 'N/A', 'TRUE', 'FALSE', 'N/A', 'FALSE'),
  ('1004', 'Dr.', 'Heinrich', 'Weber', 'Germany', '+49', '+49301234567', '701', 'ITC Maurya New Delhi', '2026-01-24', '2026-01-29', 1.0, '2026-01-24', 'LH-760', 'DEL', '23:50', '2026-01-29', 'LH-761', 'DEL', '03:10', 'Export Sector', 'Heidelberg Tech GMBH', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1005', 'Mr.', 'Suresh', 'Patel', 'India', '+91', '+919825011223', '108', 'JW Marriott Aerocity', '2026-01-25', '2026-01-27', 1.0, '2026-01-25', '6E-451', 'DEL', '11:20', '2026-01-27', '6E-454', 'DEL', '16:40', 'Bharat Buildcon', 'Gujarat Heavy Piping Corp', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1006', 'Mrs.', 'Fatima', 'Al-Zahra', 'Saudi Arabia', '+966', '+966501112233', '304', 'Taj Palace New Delhi', '2026-01-24', '2026-01-28', 1.0, '2026-01-24', 'SV-760', 'DEL', '18:40', '2026-01-28', 'SV-761', 'DEL', '22:10', 'Export Sector', 'Riyadh Contracting Co', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1007', 'Mr.', 'Chen', 'Wei', 'China', '+86', '+862168889999', '512', 'The Leela Ambience', '2026-01-25', '2026-01-29', 1.0, '2026-01-25', 'CA-947', 'DEL', '21:30', '2026-01-29', 'CA-948', 'DEL', '02:40', 'Export Sector', 'Shanghai Excavator Works', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1008', 'Mr.', 'Vikram', 'Mehta', 'India', '+91', '+919811098765', '114', 'JW Marriott Aerocity', '2026-01-26', '2026-01-28', 1.0, '2026-01-26', '6E-201', 'DEL', '08:00', '2026-01-28', '6E-202', 'DEL', '19:30', 'Bharat Buildcon', 'Delhi Smart City Developers', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1011', 'Mr.', 'Kenji', 'Takahashi', 'Japan', '+81', '+81335550199', '802', 'Taj Palace New Delhi', '2026-01-24', '2026-01-29', 1.0, '2026-01-24', 'JL-039', 'DEL', '17:15', '2026-01-29', 'JL-040', 'DEL', '20:30', 'Heavy Machinery & Equipment', 'Tokyo Heavy Machinery Corp', 'Team Lead', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1012', 'Mr.', 'Robert', 'Miller', 'USA', '+1', '+12125550144', '601', 'ITC Maurya New Delhi', '2026-01-23', '2026-01-28', 1.0, '2026-01-23', 'UA-082', 'DEL', '22:15', '2026-01-28', 'UA-083', 'DEL', '23:55', 'Heavy Machinery & Equipment', 'American Infrastructure Co', 'Team Lead', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1015', 'Mr.', 'Tenzin', 'Norbu', 'Bhutan', '+975', '+97517123456', '205', 'The Leela Ambience', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'KB-202', 'DEL', '12:05', '2026-01-28', 'KB-203', 'DEL', '15:20', 'Bharat Buildcon', 'Thimphu Eco Infra Corp', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1017', 'Mr.', 'Rahim', 'Uddin', 'Bangladesh', '+880', '+8801711223344', '208', 'The Leela Ambience', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'BG-097', 'DEL', '11:45', '2026-01-28', 'BG-098', 'DEL', '14:20', 'Bharat Buildcon', 'Dhaka Skyline Builders', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1020', 'Mr.', 'Ahmad', 'Zaki', 'Malaysia', '+60', '+60321112222', '310', 'JW Marriott Aerocity', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'MH-190', 'DEL', '19:40', '2026-01-28', 'MH-191', 'DEL', '23:05', 'Bharat Buildcon', 'KL Structural Steel', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1021', 'Mr.', 'David', 'Lim', 'Singapore', '+65', '+6567890123', '312', 'JW Marriott Aerocity', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'SQ-406', 'DEL', '20:10', '2026-01-28', 'SQ-407', 'DEL', '23:45', 'Bharat Buildcon', 'Singa Urban Solutions', 'Caller Koshti', 'Confirmed', 'N/A', 'TRUE', 'TRUE', 'N/A', 'TRUE'),
  ('1023', 'Mr.', 'Fahad', 'Al-Sabah', 'Kuwait', '+965', '+96522334455', '901', 'Taj Palace New Delhi', '2026-01-24', '2026-01-28', 1.0, '2026-01-24', 'KU-301', 'DEL', '15:20', '2026-01-28', 'KU-302', 'DEL', '19:40', 'Export Sector', 'Kuwait National Buildcon', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1025', 'Mr.', 'Nelson', 'Mandela Jr', 'South Africa', '+27', '+27214001234', '702', 'ITC Maurya New Delhi', '2026-01-24', '2026-01-29', 1.0, '2026-01-24', 'SA-222', 'DEL', '22:30', '2026-01-29', 'SA-223', 'DEL', '01:50', 'Export Sector', 'Cape Infrastructure Trust', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1027', 'Mr.', 'Kwame', 'Mensah', 'Ghana', '+233', '+233302123456', '704', 'ITC Maurya New Delhi', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'ET-901', 'DEL', '06:10', '2026-01-28', 'ET-902', 'DEL', '10:30', 'Export Sector', 'Accra Metro Development', 'Caller Deepak', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1030', 'Mr.', 'Gonzalo', 'Rojas', 'Chile', '+56', '+56229400100', '602', 'ITC Maurya New Delhi', '2026-01-23', '2026-01-29', 1.0, '2026-01-23', 'LA-801', 'DEL', '23:45', '2026-01-29', 'LA-802', 'DEL', '03:10', 'Bharat Buildcon', 'Santiago Mining Construction', 'Master Admin', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1033', 'Mr.', 'Jan', 'De Jong', 'Netherlands', '+31', '+31205550011', '803', 'Taj Palace New Delhi', '2026-01-24', '2026-01-28', 1.0, '2026-01-24', 'KL-871', 'DEL', '13:05', '2026-01-28', 'KL-872', 'DEL', '17:40', 'Heavy Machinery & Equipment', 'Amsterdam Port Heavy Tech', 'Team Lead', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1034', 'Mr.', 'Luc', 'Peeters', 'Belgium', '+32', '+3225110022', '804', 'Taj Palace New Delhi', '2026-01-25', '2026-01-28', 1.0, '2026-01-25', 'SN-255', 'DEL', '14:20', '2026-01-28', 'SN-256', 'DEL', '18:10', 'Heavy Machinery & Equipment', 'Brussels Eco Concrete', 'Team Lead', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE'),
  ('1036', 'Mr.', 'Marc', 'Schneider', 'Switzerland', '+41', '+41442110044', '805', 'Taj Palace New Delhi', '2026-01-24', '2026-01-28', 1.0, '2026-01-24', 'LX-146', 'DEL', '16:05', '2026-01-28', 'LX-147', 'DEL', '20:15', 'Heavy Machinery & Equipment', 'Zurich Precision Tools GMBH', 'Team Lead', 'Confirmed', 'Eligible', 'TRUE', 'TRUE', 'TRUE', 'TRUE')
ON CONFLICT DO NOTHING;

-- Seed Task Batches (Diverse list showing full workflow coverage)
INSERT INTO task_batches (id, name, sector, assigned_to_name, country, continent, status, completion_percent, total_delegates, completed_delegates)
VALUES
  (1, 'Export Calling Batch #1 - Middle East', 'Export Sector', 'Caller Deepak', 'UAE', 'Asia', 'in_progress', 65.00, 20, 13),
  (2, 'Domestic Buildcon Batch #4 - North India', 'Bharat Buildcon', 'Caller Koshti', 'India', 'Asia', 'in_progress', 40.00, 25, 10),
  (3, 'Heavy Machinery Buyers - Europe & East Asia', 'Heavy Machinery & Equipment', 'Team Lead', 'Germany', 'Europe', 'completed', 100.00, 15, 15),
  (4, 'Export Calling Batch #2 - East Africa', 'Export Sector', 'Caller Deepak', 'Kenya', 'Africa', 'in_progress', 20.00, 10, 2),
  (5, 'Domestic Buildcon Batch #5 - South India', 'Bharat Buildcon', 'Caller Koshti', 'India', 'Asia', 'pending', 0.00, 15, 0),
  (6, 'Heavy Machinery Buyers - Americas', 'Heavy Machinery & Equipment', 'Team Lead', 'USA', 'North America', 'in_progress', 50.00, 12, 6),
  (7, 'Export Calling Batch #3 - West Africa', 'Export Sector', 'Caller Deepak', 'Nigeria', 'Africa', 'pending', 0.00, 8, 0),
  (8, 'Domestic Buildcon Batch #6 - East India', 'Bharat Buildcon', 'Caller Koshti', 'India', 'Asia', 'completed', 100.00, 10, 10)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for task_batches
SELECT setval('task_batches_id_seq', COALESCE((SELECT MAX(id) FROM task_batches), 1));

-- Seed Task Phases Checklist (Phase tracking for all batches)
INSERT INTO task_phases (batch_id, phase_number, name, description, is_completed)
VALUES
  (1, 1, 'Initial Delegate Outreach', 'Contact delegates via ISD phone call & introduce event agenda', true),
  (1, 2, 'Travel & Passport Verification', 'Verify passport validity & travel itinerary details', true),
  (1, 3, 'Flight Booking Confirmation', 'Confirm flight ticket details and issue booking link', true),
  (1, 4, 'Hotel Accommodation & Voucher', 'Assign hotel room unit & dispatch hotel voucher', false),
  (1, 5, 'Final Badge & Invitation Dispatched', 'Send final QR invitation badge to delegate', false),
  
  (2, 1, 'Initial Delegate Outreach', 'Contact domestic delegates for attendance confirmation', true),
  (2, 2, 'Company & Product Verification', 'Verify main import product category 1 & 2', true),
  (2, 3, 'Hotel & Travel Desk Logistics', 'Check hotel requirement and local transport', false),
  (2, 4, 'Attendance Confirmation Dispatch', 'Dispatch confirmed attendance badge and voucher', false),
  
  (4, 1, 'Initial Delegate Outreach', 'Initiate calls to East African delegates', true),
  (4, 2, 'Passport Verification', 'Request passport copy upload from dashboard link', false),
  (4, 3, 'Flight Booking Desk', 'Facilitate booking process for confirmed attendees', false),
  
  (6, 1, 'Initial Delegate Outreach', 'Outreach to US/Canada buyers', true),
  (6, 2, 'B2B Meeting Setup', 'Set up business matchmaking meetings', true),
  (6, 3, 'Flight Desk Approvals', 'Approve flight reimbursement invoices', false),
  (6, 4, 'Hotel Room Assignment', 'Confirm luxury rooms at Maurya & Taj', false)
ON CONFLICT DO NOTHING;

-- Seed Operational Roster (Complete calendar coverage)
INSERT INTO roster (week, user_id, user_name, sector, country, shift_start, shift_end, effective_date, notes)
VALUES
  ('2026-W04', 4, 'Caller Koshti', 'Bharat Buildcon', 'India', '09:00:00', '18:00:00', '2026-01-20', 'Domestic Morning Shift'),
  ('2026-W04', 5, 'Caller Deepak', 'Export Sector', 'UAE', '10:00:00', '19:00:00', '2026-01-20', 'GCC & Overseas Calling Window'),
  ('2026-W04', 3, 'Team Lead', 'Bharat Buildcon', 'India', '08:30:00', '17:30:00', '2026-01-20', 'Team Supervision & Escalations'),
  ('2026-W04', 6, 'QA Auditor', 'Bharat Buildcon', 'India', '09:00:00', '18:00:00', '2026-01-20', 'Quality Audits & Scoring Logs'),
  ('2026-W05', 4, 'Caller Koshti', 'Bharat Buildcon', 'India', '09:00:00', '18:00:00', '2026-01-27', 'Domestic General Shift'),
  ('2026-W05', 5, 'Caller Deepak', 'Export Sector', 'UAE', '10:00:00', '19:00:00', '2026-01-27', 'Export Desk General Shift'),
  ('2026-W05', 3, 'Team Lead', 'Bharat Buildcon', 'India', '08:30:00', '17:30:00', '2026-01-27', 'North India Roster Sync')
ON CONFLICT DO NOTHING;

-- Seed Targets Management (Calls and Conversions targets)
INSERT INTO targets (period, period_type, user_id, user_name, calls_target, conversions_target, start_date, end_date, notes)
VALUES
  ('2026-Q1', '3m', 4, 'Caller Koshti', 300, 45, '2026-01-01', '2026-03-31', 'Q1 Domestic Conversion Goal'),
  ('2026-Q1', '3m', 5, 'Caller Deepak', 350, 60, '2026-01-01', '2026-03-31', 'Q1 Export Conversion Goal'),
  ('2026-H1', '6m', 3, 'Team Lead', 1000, 180, '2026-01-01', '2026-06-30', 'H1 Overall Team Goal'),
  ('2026-Q2', '3m', 4, 'Caller Koshti', 400, 65, '2026-04-01', '2026-06-30', 'Q2 Target Scaling'),
  ('2026-Q2', '3m', 5, 'Caller Deepak', 450, 80, '2026-04-01', '2026-06-30', 'Q2 Overseas Sourcing Target')
ON CONFLICT DO NOTHING;

-- Seed QA Scores (Highly filled list of quality reports)
INSERT INTO qa_scores (call_log_id, auditor_id, auditor_name, caller_id, caller_name, script_adherence, tone, data_accuracy, customer_handling, overall_score, notes)
VALUES
  (101, 6, 'QA Auditor', 4, 'Caller Koshti', 4.50, 4.80, 4.20, 4.70, 4.55, 'Excellent call handling and polite tone.'),
  (102, 6, 'QA Auditor', 5, 'Caller Deepak', 4.80, 4.90, 4.70, 4.80, 4.80, 'Outstanding international delegate engagement and fast resolution.'),
  (103, 6, 'QA Auditor', 4, 'Caller Koshti', 4.00, 4.20, 3.90, 4.10, 4.05, 'Good adherence to script; remind delegate about hotel voucher.'),
  (104, 6, 'QA Auditor', 5, 'Caller Deepak', 4.90, 4.80, 4.90, 4.90, 4.88, 'Strong performance. Verified all import product categories correctly.'),
  (105, 6, 'QA Auditor', 4, 'Caller Koshti', 3.80, 4.00, 3.50, 3.80, 3.78, 'Needs to slow down pitch. Missed asking company website details.'),
  (106, 6, 'QA Auditor', 5, 'Caller Deepak', 4.70, 4.60, 4.80, 4.70, 4.70, 'Polite behavior. Smooth handling of flight reservation queries.')
ON CONFLICT DO NOTHING;

-- Seed Team Chat & Group Messages (Populated chats for messaging dashboard)
INSERT INTO chat_messages (user_id, recipient_id, thread_type, thread_id, message, created_at)
VALUES
  (1, NULL, 'team', 'bharat_buildcon_2026', 'Welcome to Team Chat! Project X messaging is live.', NOW() - INTERVAL '4 hours'),
  (3, NULL, 'team', 'bharat_buildcon_2026', 'Batch #1 Middle East is 65% completed. Great work @Caller Deepak!', NOW() - INTERVAL '3 hours'),
  (5, NULL, 'group', '1', 'Export Sector calling is active. Gulf Heavy Structures LLC has confirmed attendance!', NOW() - INTERVAL '2 hours'),
  (4, 1, 'direct', NULL, 'Hi Admin, please verify hotel voucher allocation for Sr No 1002.', NOW() - INTERVAL '90 minutes'),
  (1, 4, 'direct', NULL, 'Hotel voucher for Sr No 1002 has been verified and dispatched.', NOW() - INTERVAL '80 minutes'),
  (3, NULL, 'team', 'bharat_buildcon_2026', 'Reminder: Weekly sync scheduled for Friday at 11 AM IST.', NOW() - INTERVAL '70 minutes'),
  (4, NULL, 'team', 'bharat_buildcon_2026', 'Understood, will submit targets update sheet before that.', NOW() - INTERVAL '60 minutes'),
  (5, NULL, 'group', '1', 'Heidelberg Tech GMBH visa invitation letter sent successfully.', NOW() - INTERVAL '50 minutes'),
  (2, NULL, 'team', 'bharat_buildcon_2026', 'All regional sheets synced with Supabase successfully.', NOW() - INTERVAL '40 minutes'),
  (6, NULL, 'team', 'bharat_buildcon_2026', 'QA audit scores for callers have been updated in the QA Scorecard panel.', NOW() - INTERVAL '30 minutes'),
  (5, 3, 'direct', NULL, 'Hi Team Lead, need approval for a flight reimbursement code FH-902.', NOW() - INTERVAL '20 minutes'),
  (3, 5, 'direct', NULL, 'Deepak, code FH-902 is approved. Go ahead and log it.', NOW() - INTERVAL '15 minutes'),
  (4, 3, 'direct', NULL, 'Sir, Suresh Patel confirmed flight booking for 25th Jan.', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- Seed Notifications (In-app notifications dashboard)
INSERT INTO notifications (target_user_id, source_user_id, type, title, message, priority, read)
VALUES
  (4, 1, 'task_assigned', 'New Task Batch Assigned', 'You have been assigned Domestic Buildcon Batch #4 (25 delegates).', 'normal', false),
  (5, 3, 'call_escalation', 'High-Priority Overseas Buyer', 'Tariq Al-Mansoor (UAE) requested callback regarding hotel suite reservation.', 'high', false),
  (4, 6, 'qa_score', 'QA Audit Score Published', 'Your call audit score for Call #101 is 4.55/5.00.', 'normal', true),
  (5, 1, 'task_assigned', 'New Sourcing Lead Assigned', 'New lead Chen Wei (China) assigned to you for Export Sector calling.', 'normal', false),
  (3, 5, 'escalation', 'Reimbursement Approval Request', 'Deepak requested flight reimbursement approval for FH-902.', 'high', false),
  (4, 1, 'system', 'Roster Update Notice', 'Shift schedule for week 2026-W05 is published. Check workforce panel.', 'normal', false)
ON CONFLICT DO NOTHING;

-- Seed Email Logs (Detailed email engine tracking logs)
INSERT INTO email_logs (sender_id, recipient_email, recipient_name, template_name, subject, body, status)
VALUES
  (1, 'tariq@gulfheavy.ae', 'Tariq Al-Mansoor', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Tariq Al-Mansoor, We invite Gulf Heavy Structures LLC to Bharat Buildcon 2026.', 'sent'),
  (1, 'h.weber@heidelbergtech.de', 'Heinrich Weber', 'visa_support', 'Visa Support Document — Bharat Buildcon 2026', 'Dear Heinrich Weber, Attached is your visa support letter.', 'sent'),
  (2, 'amina@nairobiurban.co.ke', 'Amina Kassim', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Amina Kassim, We invite Nairobi Urban Developers to Bharat Buildcon 2026.', 'queued'),
  (1, 'suresh@gujarathp.com', 'Suresh Patel', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Suresh Patel, We invite Gujarat Heavy Piping Corp to Bharat Buildcon 2026.', 'sent'),
  (2, 'f.alzahra@riyadhcon.sa', 'Fatima Al-Zahra', 'visa_support', 'Visa Support Document — Bharat Buildcon 2026', 'Dear Fatima Al-Zahra, Attached is your visa support letter.', 'sent'),
  (3, 'chen.wei@shanghaiexc.cn', 'Chen Wei', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Chen Wei, We invite Shanghai Excavator Works to Bharat Buildcon 2026.', 'sent'),
  (1, 'v.mehta@delhismartcity.org', 'Vikram Mehta', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Vikram Mehta, We invite Delhi Smart City Developers to Bharat Buildcon 2026.', 'failed'),
  (2, 'karan@ktminfra.np', 'Karan Singh', 'invitation_letter', 'Bharat Buildcon 2026 — Official Invitation Letter', 'Dear Karan Singh, We invite Kathmandu Infra Group to Bharat Buildcon 2026.', 'sent')
ON CONFLICT DO NOTHING;

-- Seed Operation Logs (Complete audit log list)
INSERT INTO operation_logs (user_id, user_name, user_role, action, entity_type, entity_id, status)
VALUES
  (1, 'Master Admin', 'admin', 'system_init', 'database', 1, 'success'),
  (1, 'Master Admin', 'admin', 'batch_allocation', 'task_batch', 1, 'success'),
  (5, 'Caller Deepak', 'caller', 'registration_update', 'registration', 1001, 'success'),
  (6, 'QA Auditor', 'qa_auditor', 'qa_score_submitted', 'qa_score', 101, 'success'),
  (2, 'Regional Supervisor', 'regional_admin', 'user_created', 'users', 4, 'success'),
  (3, 'Team Lead', 'team_lead', 'shift_roster_created', 'roster', 1, 'success'),
  (1, 'Master Admin', 'admin', 'settings_update', 'app_settings', 1, 'success'),
  (4, 'Caller Koshti', 'caller', 'registration_update', 'registration', 1002, 'success'),
  (5, 'Caller Deepak', 'caller', 'chat_message_sent', 'chat_messages', 3, 'success'),
  (6, 'QA Auditor', 'qa_auditor', 'qa_score_submitted', 'qa_score', 102, 'success'),
  (1, 'Master Admin', 'admin', 'backup_executed', 'google_sheet', 1, 'success'),
  (2, 'Regional Supervisor', 'regional_admin', 'email_log_dispatched', 'email_logs', 4, 'success')
ON CONFLICT DO NOTHING;

-- Seed Sample App Settings
INSERT INTO app_settings (id, event_id, event_name, session_timeout_minutes, feature_flag_ai_scoring, notifications_enabled)
VALUES (1, 'bharat_buildcon_2026', 'Bharat Buildcon 2026', 30, true, true)
ON CONFLICT DO NOTHING;

COMMIT;


