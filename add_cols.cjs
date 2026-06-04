const postgres = require('postgres');

// Support loading .env.local manually
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch (e) {}

const DB_URL = process.env.DATABASE_URL || "postgres://postgres.tjqzcpddonqiunpcrmfo:LAdSwzGwqPcNuUZE@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x";
const sql = postgres(DB_URL, { prepare: false });

async function main() {
  console.log("Adding columns...");
  try { await sql`ALTER TABLE "travel_records" ADD COLUMN "reimbursement_amount" text;`; console.log("Added reimbursement_amount"); } catch(e) { console.log(e.message); }
  try { await sql`ALTER TABLE "travel_records" ADD COLUMN "bl" text;`; console.log("Added bl"); } catch(e) { console.log(e.message); }
  try { await sql`ALTER TABLE "travel_records" ADD COLUMN "business_card_url" text;`; console.log("Added business_card_url"); } catch(e) { console.log(e.message); }
  try { await sql`ALTER TABLE "travel_records" ADD COLUMN "business_card_drive_id" text;`; console.log("Added business_card_drive_id"); } catch(e) { console.log(e.message); }
  
  // also check if registrations table exists
  try { await sql`SELECT id FROM registrations LIMIT 1`; console.log("Registrations table exists"); } catch(e) { console.log("Registrations table error:", e.message); }
  
  process.exit(0);
}
main();
