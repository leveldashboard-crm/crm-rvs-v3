import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { canManageEmailTemplates, normalizeRole } from "@/lib/rbac";

// ─── GET /api/v1/email-templates ─────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sector = url.searchParams.get("sector")?.trim();

  try {
    const templates = await db
      .select()
      .from(emailTemplates)
      .orderBy(asc(emailTemplates.name));

    const filtered = sector && sector !== "all"
      ? templates.filter((t) => !t.sector || t.sector.toLowerCase() === sector.toLowerCase())
      : templates;

    return NextResponse.json({ templates: filtered });
  } catch (err) {
    console.error("[GET /api/v1/email-templates]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ─── POST /api/v1/email-templates ────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = normalizeRole((session.user as { role?: string }).role);
  if (!canManageEmailTemplates(role)) {
    return NextResponse.json({ error: "Forbidden — Team Lead+ required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, sector, subject, body: templateBody } = body as {
      name: string;
      sector?: string;
      subject: string;
      body: string;
    };

    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 });
    }

    const userId = session.user?.id ? parseInt(session.user.id) : null;

    const [inserted] = await db
      .insert(emailTemplates)
      .values({
        name: name.trim(),
        sector: sector ?? null,
        subject: subject.trim(),
        body: templateBody.trim(),
        createdById: userId,
      })
      .returning();

    return NextResponse.json({ ok: true, template: inserted });
  } catch (err: unknown) {
    console.error("[POST /api/v1/email-templates]", err);
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
