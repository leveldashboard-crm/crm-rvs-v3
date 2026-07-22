import postgres from "postgres";

const supabaseUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "postgres://postgres.tjqzcpddonqiunpcrmfo:LAdSwzGwqPcNuUZE@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";

console.log("Connecting to Supabase Database:", supabaseUrl.replace(/:[^:@]+@/, ":****@"));

const sql = postgres(supabaseUrl, { prepare: false, ssl: "require" });

async function syncSupabase() {
  try {
    console.log("Creating tables on Supabase...");

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        event_id TEXT DEFAULT 'bharat_buildcon_2026',
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        thread_type TEXT DEFAULT 'task',
        thread_id TEXT,
        message TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        file_size TEXT,
        attachments JSONB,
        is_edited BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;

    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        event_id TEXT DEFAULT 'bharat_buildcon_2026' UNIQUE,
        event_name TEXT DEFAULT 'Bharat Buildcon 2026',
        sheet_id TEXT,
        script_url TEXT,
        drive_folder_id TEXT,
        backup_sheet_id TEXT,
        mailer_web_app_url TEXT,
        mailer_shared_secret TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;

    console.log("Seeding Supabase default users...");

    await sql`
      INSERT INTO users (name, email, role, sector, country)
      VALUES
        ('Master Admin', 'admin@buildcon.com', 'admin', 'Bharat Buildcon', 'India'),
        ('Supervisor', 'regional_admin@buildcon.com', 'regional_admin', 'Bharat Buildcon', 'India'),
        ('Team Lead', 'team_lead@buildcon.com', 'team_lead', 'Bharat Buildcon', 'India'),
        ('Caller Koshti', 'caller@buildcon.com', 'caller', 'Bharat Buildcon', 'India'),
        ('Caller Deepak', 'caller2@buildcon.com', 'caller', 'Export Sector', 'UAE'),
        ('QA Auditor', 'qa_auditor@buildcon.com', 'qa_auditor', 'Bharat Buildcon', 'India'),
        ('BI Analyst', 'analyst@buildcon.com', 'analyst', 'Bharat Buildcon', 'India')
      ON CONFLICT (email) DO NOTHING;
    `;

    console.log("Seeding Supabase chat groups...");
    await sql`
      INSERT INTO chat_groups (name, description, member_ids)
      VALUES
        ('Export Calling Desk', 'Export Sector Calling & Strategy', '[1, 2, 3, 4]'::jsonb),
        ('Bharat Buildcon Operations', 'Main operations and team updates', '[1, 2, 3, 4, 5, 6, 7]'::jsonb),
        ('High-Priority Follow-ups', 'Delegates requiring immediate response', '[1, 3, 4]'::jsonb)
      ON CONFLICT DO NOTHING;
    `;

    console.log("Successfully synced Supabase PostgreSQL tables and seeded users!");
  } catch (err) {
    console.error("Supabase Sync Failed:", err);
  } finally {
    await sql.end();
  }
}

syncSupabase();
