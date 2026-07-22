-- Project X Migration Script

-- 1. Sectors table
CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  countries JSONB,
  default_phases JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed Default Sectors
INSERT INTO sectors (name, code, countries, default_phases)
VALUES 
  ('Export Calling', 'export_calling', '["Germany","Oman","South Korea","UAE","USA"]'::jsonb, '["Data Collection","Initial Calling","Follow-up","Registration Closure"]'::jsonb),
  ('Bharat Buildcon', 'bharat_buildcon', '["India","Sri Lanka","Bangladesh","Nepal","Vietnam"]'::jsonb, '["Data Collection","Initial Calling","Follow-up","Registration Closure"]'::jsonb),
  ('Food Pro', 'food_pro', '["Thailand","Indonesia","Malaysia","Singapore","Japan"]'::jsonb, '["Data Collection","Initial Calling","Follow-up","Registration Closure"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 2. Add columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Bharat Buildcon';
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_countries JSONB;

-- 3. Add columns to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Bharat Buildcon';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS personal_info TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS email_comments TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS comments_history JSONB;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. Task Batches Table
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
  completion_percent INTEGER DEFAULT 0,
  total_delegates INTEGER DEFAULT 0,
  completed_delegates INTEGER DEFAULT 0,
  locked_by INTEGER,
  locked_at TIMESTAMP,
  lock_expires_at TIMESTAMP,
  due_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure task_batches columns exist if created previously
ALTER TABLE task_batches ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Bharat Buildcon';
ALTER TABLE task_batches ADD COLUMN IF NOT EXISTS time_link TEXT;
ALTER TABLE task_batches ADD COLUMN IF NOT EXISTS assigned_to_ids JSONB;
ALTER TABLE task_batches ADD COLUMN IF NOT EXISTS completion_percent INTEGER DEFAULT 0;

-- 5. Add columns to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thread_type TEXT DEFAULT 'task';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB;

-- 6. Task Phases
CREATE TABLE IF NOT EXISTS task_phases (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES task_batches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'not_started' NOT NULL,
  updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. Roster
CREATE TABLE IF NOT EXISTS roster (
  id SERIAL PRIMARY KEY,
  event_id TEXT DEFAULT 'bharat_buildcon_2026',
  week TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  sector TEXT NOT NULL,
  country TEXT NOT NULL,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 8. Targets
CREATE TABLE IF NOT EXISTS targets (
  id SERIAL PRIMARY KEY,
  event_id TEXT DEFAULT 'bharat_buildcon_2026',
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  sector TEXT,
  period TEXT NOT NULL,
  goal INTEGER DEFAULT 0 NOT NULL,
  current_attainment INTEGER DEFAULT 0 NOT NULL,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 9. Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  event_id TEXT DEFAULT 'bharat_buildcon_2026',
  lead_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
  sent_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  recipient_email TEXT NOT NULL,
  cc_list JSONB,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_used TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 10. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  event_id TEXT DEFAULT 'bharat_buildcon_2026',
  name TEXT NOT NULL,
  sector TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed default email templates
INSERT INTO email_templates (name, sector, subject, body)
VALUES
  ('Initial Delegate Invitation', 'Bharat Buildcon', 'Invitation to Bharat Buildcon 2026 — {{company}}', 'Dear {{name}},\n\nWe are pleased to invite {{company}} to participate in Bharat Buildcon 2026.\n\nPlease complete your registration at your earliest convenience.\n\nBest regards,\nDelegates Team'),
  ('Follow-Up Booking Confirmation', 'Export Calling', 'Follow-up Call Scheduled — {{company}}', 'Hi {{name}},\n\nThank you for speaking with us today. As discussed, here is the booking link for our upcoming follow-up call: {{time_link}}\n\nBest regards,\nExport Team'),
  ('Food Pro Delegate Pass', 'Food Pro', 'Food Pro 2026 Delegate Pass — {{company}}', 'Dear {{name}},\n\nYour delegate pass for Food Pro 2026 has been generated. Please review your details and let us know if any adjustments are needed.\n\nBest regards,\nFood Pro Desk')
ON CONFLICT DO NOTHING;
