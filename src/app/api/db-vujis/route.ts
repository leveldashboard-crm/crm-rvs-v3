import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dbVujisRecords } from "@/db/schema";
import { asc, sql } from "drizzle-orm";

// ─── GET /api/db-vujis ────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit  = parseInt(url.searchParams.get("limit")  ?? "5000");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  try {
    const rows = await db
      .select()
      .from(dbVujisRecords)
      .orderBy(asc(dbVujisRecords.srNo))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dbVujisRecords);

    return NextResponse.json({ rows, total: Number(countRow?.count ?? 0) });
  } catch (err) {
    console.error("[GET /api/db-vujis]", err);
    return NextResponse.json({ error: "Database error", rows: [], total: 0 }, { status: 500 });
  }
}
