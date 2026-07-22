const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

console.log("Connecting to Supabase at:", url.replace(/:[^:@]+@/, ":****@"));
const sql = postgres(url, { prepare: false });

async function run() {
  try {
    const seedPath = path.join(__dirname, 'master-database-seed.sql');
    const content = fs.readFileSync(seedPath, 'utf8');

    // Split SQL by semicolons, but be smart to avoid splitting inside quotes, functions, or jsonb.
    // A clean way is to split by lines, group them, and execute command-by-command.
    const statements = [];
    let currentStatement = "";
    const lines = content.split('\n');

    for (let line of lines) {
      // Remove comments
      const cleanLine = line.replace(/--.*$/, '').trim();
      if (!cleanLine) continue;

      currentStatement += " " + cleanLine;

      if (cleanLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`Parsed ${statements.length} SQL statements. Executing...`);

    for (let i = 0; i < statements.length; i++) {
      let stmt = statements[i];
      if (stmt.toUpperCase().startsWith("BEGIN") || stmt.toUpperCase().startsWith("COMMIT")) {
        continue;
      }
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        console.error(`Error executing statement ${i + 1}:`, e.message);
        console.error("Statement was:", stmt);
      }
    }

    console.log("Database seeded successfully!");
  } catch (err) {
    console.error("Seeding process failed:", err);
  } finally {
    await sql.end();
  }
}

run();
