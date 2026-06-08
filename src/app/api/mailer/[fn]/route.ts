import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { callMailer } from "@/lib/mailer/client";

// Admin check helper
async function requireAdmin() {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 };
  if ((session.user as { role?: string })?.role !== "admin")
    return { error: "Forbidden – admin role required", status: 403 };
  return { session };
}

const ALLOWED = new Set([
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
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { fn } = await params;
  if (!ALLOWED.has(fn)) {
    return NextResponse.json({ success: false, error: "fn not allowed" }, { status: 400 });
  }

  try {
    const { args = [] } = await req.json().catch(() => ({ args: [] }));
    const result = await callMailer(fn, args);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[POST /api/mailer/${fn}]`, err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message || "Mailer API Error" }, { status: 500 });
  }
}
