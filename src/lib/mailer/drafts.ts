import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureMailerSchema } from "./db";
import { randomUUID } from "crypto";

export interface Draft {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  plainBody: string;
  cc: string;
  bcc: string;
  created?: string;
  modified?: string;
}

interface DraftRow {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  plain_body: string;
  cc: string;
  bcc: string;
  created_at: unknown;
  updated_at: unknown;
}

// ─── Get Drafts ───────────────────────────────────────────────────────────────
export async function getDrafts(): Promise<{ success: boolean; result?: Draft[]; error?: string }> {
  try {
    await ensureMailerSchema();
    const rows = Array.from(await db.execute(sql`
      SELECT id, name, subject, html_body, plain_body, cc, bcc, created_at, updated_at
      FROM mailer_drafts ORDER BY updated_at DESC
    `)) as unknown as DraftRow[];

    const drafts: Draft[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      htmlBody: r.html_body,
      plainBody: r.plain_body,
      cc: r.cc,
      bcc: r.bcc,
      created: r.created_at ? String(r.created_at) : undefined,
      modified: r.updated_at ? String(r.updated_at) : undefined,
    }));
    return { success: true, result: drafts };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Save Draft ───────────────────────────────────────────────────────────────
export async function saveDraft(draft: Partial<Draft>) {
  try {
    await ensureMailerSchema();
    const id = draft.id || randomUUID();
    const name = draft.name || `Draft ${new Date().toISOString().slice(0, 10)}`;
    const subject = draft.subject || "";
    const htmlBody = draft.htmlBody || "";
    const plainBody = draft.plainBody || htmlBody.replace(/<[^>]+>/g, "");
    const cc = draft.cc || "";
    const bcc = draft.bcc || "";

    await db.execute(sql`
      INSERT INTO mailer_drafts (id, name, subject, html_body, plain_body, cc, bcc, created_at, updated_at)
      VALUES (${id}, ${name}, ${subject}, ${htmlBody}, ${plainBody}, ${cc}, ${bcc}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        subject = EXCLUDED.subject,
        html_body = EXCLUDED.html_body,
        plain_body = EXCLUDED.plain_body,
        cc = EXCLUDED.cc,
        bcc = EXCLUDED.bcc,
        updated_at = NOW()
    `);
    return { success: true, result: { id, name } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Delete Draft ─────────────────────────────────────────────────────────────
export async function deleteDraft(draftId: string) {
  try {
    await ensureMailerSchema();
    await db.execute(sql`DELETE FROM mailer_drafts WHERE id = ${draftId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
