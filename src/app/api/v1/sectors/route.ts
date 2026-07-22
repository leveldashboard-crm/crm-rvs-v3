import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sectors } from "@/db/schema";
import { normalizeRole, canManageSectors } from "@/lib/rbac";
import { eq, asc } from "drizzle-orm";

// ─── GET /api/v1/sectors ──────────────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(sectors)
      .orderBy(asc(sectors.id));

    // Fallback defaults if table is empty
    if (rows.length === 0) {
      const defaultSectors = [
        {
          id: 1,
          name: "Export Calling",
          code: "export_calling",
          countries: ["Germany", "Oman", "South Korea", "UAE", "USA"],
          defaultPhases: ["Data Collection", "Initial Calling", "Follow-up", "Registration Closure"],
        },
        {
          id: 2,
          name: "Bharat Buildcon",
          code: "bharat_buildcon",
          countries: ["India", "Sri Lanka", "Bangladesh", "Nepal", "Vietnam"],
          defaultPhases: ["Data Collection", "Initial Calling", "Follow-up", "Registration Closure"],
        },
        {
          id: 3,
          name: "Food Pro",
          code: "food_pro",
          countries: ["Thailand", "Indonesia", "Malaysia", "Singapore", "Japan"],
          defaultPhases: ["Data Collection", "Initial Calling", "Follow-up", "Registration Closure"],
        },
      ];
      return NextResponse.json({ sectors: defaultSectors });
    }

    return NextResponse.json({ sectors: rows });
  } catch (err) {
    console.error("[GET /api/v1/sectors]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/sectors ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  if (!canManageSectors(role)) {
    return NextResponse.json({ error: "Forbidden: Master Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, code, countries, defaultPhases } = body as {
      name: string;
      code: string;
      countries?: string[];
      defaultPhases?: string[];
    };

    if (!name || !code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(sectors)
      .values({
        name,
        code,
        countries: countries ?? [],
        defaultPhases: defaultPhases ?? ["Data Collection", "Initial Calling", "Follow-up", "Registration Closure"],
      })
      .returning();

    return NextResponse.json({ ok: true, sector: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/sectors]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH /api/v1/sectors ────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  if (!canManageSectors(role)) {
    return NextResponse.json({ error: "Forbidden: Master Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, countries, defaultPhases } = body as {
      id: number;
      name?: string;
      countries?: string[];
      defaultPhases?: string[];
    };

    if (!id) return NextResponse.json({ error: "Sector ID required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (countries) updates.countries = countries;
    if (defaultPhases) updates.defaultPhases = defaultPhases;

    const [updated] = await db
      .update(sectors)
      .set(updates)
      .where(eq(sectors.id, id))
      .returning();

    return NextResponse.json({ ok: true, sector: updated });
  } catch (err: unknown) {
    console.error("[PATCH /api/v1/sectors]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
