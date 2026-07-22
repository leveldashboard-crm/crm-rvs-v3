import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { callMailer } from "@/lib/mailer/client";
import { normalizeRole } from "@/lib/rbac";

async function requireAuthUser() {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 };
  const rawRole = (session.user as { role?: string })?.role;
  const role = normalizeRole(rawRole);

  if (role !== "master_admin" && role !== "regional_admin" && role !== "team_lead" && role !== "caller") {
    return { error: "Forbidden – Mailer access required", status: 403 };
  }
  return { session };
}


const ALLOWED = new Set([
  "verifySmtp",
  "getFolderConfig",
  "buildIndex",
  "matchDelegates",
  "rematchOne",
  "getDrafts",
  "saveDraft",
  "deleteDraft",
  "sendOne",
  "getSendLog",
  "searchDriveFiles",
  "getSheetUrl",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ fn: string }> }) {
  const check = await requireAuthUser();
  if ("error" in check || !check.session) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { fn } = await params;
  if (!ALLOWED.has(fn)) {
    return NextResponse.json({ success: false, error: "fn not allowed" }, { status: 400 });
  }

  const user = check.session.user;
  const senderInfo = {
    name: user?.name || user?.email || "User",
    email: user?.email || "",
  };

  try {
    const { args = [] } = await req.json().catch(() => ({ args: [] }));
    const result = await callMailer(fn, args, senderInfo);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[POST /api/mailer/${fn}]`, err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message || "Mailer API Error" }, { status: 500 });
  }
}

