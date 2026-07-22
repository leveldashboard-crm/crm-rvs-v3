import { NextResponse } from "next/server";
import postgres from "postgres";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json(
      { error: "Forbidden. Pass ?key=YOUR_ADMIN_SECRET_KEY" },
      { status: 403 }
    );
  }

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured in environment variables" },
      { status: 500 }
    );
  }

  const sql = postgres(dbUrl, { prepare: false });
  const results: { statementIndex: number; query: string; status: string; error?: string }[] = [];

  try {
    const seedPath = path.join(process.cwd(), "scripts", "master-database-seed.sql");
    if (!fs.existsSync(seedPath)) {
      return NextResponse.json(
        { error: `Database seed file not found at path: ${seedPath}` },
        { status: 500 }
      );
    }

    const content = fs.readFileSync(seedPath, "utf8");

    // Parse the multi-statement SQL script into individual statements safely.
    const statements: string[] = [];
    let currentStatement = "";
    const lines = content.split("\n");

    for (let line of lines) {
      // Exclude SQL comment lines
      const cleanLine = line.replace(/--.*$/, "").trim();
      if (!cleanLine) continue;

      currentStatement += " " + cleanLine;

      if (cleanLine.endsWith(";")) {
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`Parsed ${statements.length} statements from master-database-seed.sql.`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Skip transactional wrappers as we execute statements sequentially
      if (stmt.toUpperCase().startsWith("BEGIN") || stmt.toUpperCase().startsWith("COMMIT")) {
        continue;
      }
      try {
        await sql.unsafe(stmt);
        results.push({ statementIndex: i + 1, query: stmt.slice(0, 100) + "...", status: "SUCCESS" });
      } catch (err: unknown) {
        results.push({
          statementIndex: i + 1,
          query: stmt.slice(0, 100) + "...",
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Failed to read database seed file", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  } finally {
    await sql.end();
  }

  const failedCount = results.filter((r) => r.status === "FAILED").length;

  return NextResponse.json({
    ok: failedCount === 0,
    message: failedCount === 0
      ? "✅ Database schema sync & full mock data seeding completed successfully! All tables populated."
      : `⚠️ Seeding completed with ${failedCount} errors. Review detailed statement logs below.`,
    totalStatementsExecuted: results.length,
    failedStatementsCount: failedCount,
    results: results.filter((r) => r.status === "FAILED" || results.length <= 20), // Show failures or sample of executions
    credentials: {
      master_admin:   { email: "admin@buildcon.com",          password: "buildcon2026" },
      regional_admin: { email: "regional_admin@buildcon.com", password: "buildcon2026" },
      team_lead:       { email: "team_lead@buildcon.com",      password: "buildcon2026" },
      caller_koshti:   { email: "caller@buildcon.com",         password: "buildcon2026" },
      caller_deepak:   { email: "caller2@buildcon.com",        password: "buildcon2026" },
      qa_auditor:      { email: "qa_auditor@buildcon.com",     password: "buildcon2026" },
      analyst:         { email: "analyst@buildcon.com",        password: "buildcon2026" },
    },
  });
}
