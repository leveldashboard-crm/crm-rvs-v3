import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { normalizeRole, canManageUsers, canManageAllUsers, isAtLeast } from "@/lib/rbac";

// Helper – Regional Admin+ can manage users
async function requireAdmin() {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 };
  const role = normalizeRole((session.user as { role?: string })?.role);
  if (!canManageUsers(role))
    return { error: "Forbidden – Regional Admin+ required", status: 403 };
  return { session, callerRole: role };
}

const VALID_ROLES = ["master_admin", "regional_admin", "team_lead", "caller", "qa_auditor", "analyst"];

// ─── GET /api/admin/users — list all users ────────────────────────────────────
export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      sector: users.sector,
      country: users.country,
      assignedCountries: users.assignedCountries,
      region: users.region,
      continent: users.continent,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(users.createdAt);

  return NextResponse.json({ users: allUsers });
}

// ─── POST /api/admin/users — create user ─────────────────────────────────────
export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  try {
    const { email, password, name, role, sector, country, assignedCountries, region, continent } = await request.json() as {
      email: string; password: string; name?: string; role?: string; sector?: string; country?: string; assignedCountries?: string[]; region?: string; continent?: string;
    };

    if (!email?.trim() || !password?.trim())
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });

    const assignedRole = VALID_ROLES.includes(role ?? "") ? role! : "caller";

    // Only Master Admin can create/grant Master Admin role
    if (assignedRole === "master_admin" && !canManageAllUsers(check.callerRole)) {
      return NextResponse.json({ error: "Forbidden: Only Master Admin can grant Master Admin role" }, { status: 403 });
    }

    const passwordHash = hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name ?? email,
        role: assignedRole,
        sector: sector ?? "Bharat Buildcon",
        country: country ?? null,
        assignedCountries: assignedCountries ?? [],
        region: region ?? null,
        continent: continent ?? null,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash,
          name: name ?? email,
          role: assignedRole,
          sector: sector ?? "Bharat Buildcon",
          country: country ?? null,
          assignedCountries: assignedCountries ?? [],
          region: region ?? null,
          continent: continent ?? null,
          updatedAt: new Date()
        },
      })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, assignedCountries: users.assignedCountries });

    return NextResponse.json({ ok: true, user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PUT /api/admin/users — update role / name / assignedCountries ───────────────────────────────
export async function PUT(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  try {
    const { id, role, name, password, sector, country, assignedCountries, region, continent } = await request.json() as {
      id: number; role?: string; name?: string; password?: string; sector?: string; country?: string; assignedCountries?: string[]; region?: string; continent?: string;
    };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (role && VALID_ROLES.includes(role)) {
      // Only Master Admin can grant/demote Master Admin role
      if ((role === "master_admin" || updates.role === "master_admin") && !canManageAllUsers(check.callerRole)) {
        return NextResponse.json({ error: "Forbidden: Only Master Admin can modify Master Admin role status" }, { status: 403 });
      }
      updates.role = role;
    }
    if (name) updates.name = name;
    if (password) updates.passwordHash = hashPassword(password);
    if (sector !== undefined) updates.sector = sector;
    if (country !== undefined) updates.country = country;
    if (assignedCountries !== undefined) updates.assignedCountries = assignedCountries;
    if (region !== undefined) updates.region = region;
    if (continent !== undefined) updates.continent = continent;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning({
      id: users.id, email: users.email, name: users.name, role: users.role, assignedCountries: users.assignedCountries,
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}


// ─── DELETE /api/admin/users — delete user ───────────────────────────────────
export async function DELETE(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get("id") ?? "0");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Prevent deleting yourself
  const sessionUserId = parseInt((check.session!.user as { id?: string })?.id ?? "0");
  if (id === sessionUserId)
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });

  // Check target user to verify they aren't master admin unless caller is master admin
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  if (target && normalizeRole(target.role) === "master_admin" && !canManageAllUsers(check.callerRole)) {
    return NextResponse.json({ error: "Forbidden: Only Master Admin can delete another Master Admin account" }, { status: 403 });
  }

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}

