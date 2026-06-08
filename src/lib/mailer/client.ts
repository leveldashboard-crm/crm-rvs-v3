import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

type MailerResult<T = unknown> = { success: boolean; error?: string } & T;

async function loadSetting(key: "mailer.webAppUrl" | "mailer.sharedSecret"): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT mailer_web_app_url, mailer_shared_secret FROM app_settings WHERE id = 1 LIMIT 1
    `);
    const rows = Array.from(result);
    if (rows.length === 0) return null;
    const row = rows[0] as { mailer_web_app_url?: string | null; mailer_shared_secret?: string | null };
    if (key === "mailer.webAppUrl") return row.mailer_web_app_url || null;
    if (key === "mailer.sharedSecret") return row.mailer_shared_secret || null;
  } catch (e) {
    console.error("Error loading mailer setting:", e);
  }
  return null;
}

async function getConfig() {
  const url = process.env.MAILER_WEBAPP_URL ?? (await loadSetting("mailer.webAppUrl"));
  const secret = process.env.MAILER_SHARED_SECRET ?? (await loadSetting("mailer.sharedSecret"));
  if (!url || !secret) {
    throw new Error("Mailer is not fully configured. Please configure the Web App URL and Shared Secret in settings.");
  }
  return { url, secret };
}

export async function callMailer<T = unknown>(fn: string, args: unknown[] = []): Promise<MailerResult<T>> {
  const { url, secret } = await getConfig();
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, fn, args }),
    redirect: "follow",
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Mailer HTTP error: ${res.status}`);
  }
  
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Mailer returned non-JSON response. Check Web App URL, deployment access, or shared secret.");
  }
}
