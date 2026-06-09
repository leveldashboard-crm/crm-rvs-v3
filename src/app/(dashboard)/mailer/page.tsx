import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import MailerPortal from "@/components/mailer/MailerPortal";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Concierge Mailer — DelegateConnect",
  description: "Send personalised emails and Drive attachments to delegates",
};

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
  if (role !== "admin") {
    redirect("/");
  }

  // Load mailer settings — check if SMTP is configured (enabled means smtp_user is set)
  let mailerEnabled = false;
  let mailerMode = "api";

  try {
    const result = await db.execute(sql`
      SELECT
        mailer_enabled,
        mailer_mode,
        COALESCE(mailer_smtp_user, '') AS mailer_smtp_user
      FROM app_settings WHERE id = 1 LIMIT 1
    `);
    const rows = Array.from(result);
    if (rows.length > 0) {
      const row = rows[0] as {
        mailer_enabled: boolean | null;
        mailer_mode: string | null;
        mailer_smtp_user: string | null;
      };
      mailerEnabled = !!row.mailer_enabled;
      mailerMode = row.mailer_mode || "api";
    }
  } catch {
    // mailer_smtp_user column may not exist yet — treat as not configured
    try {
      const result2 = await db.execute(sql`
        SELECT mailer_enabled, mailer_mode FROM app_settings WHERE id = 1 LIMIT 1
      `);
      const rows2 = Array.from(result2);
      if (rows2.length > 0) {
        const row2 = rows2[0] as { mailer_enabled: boolean | null; mailer_mode: string | null };
        mailerEnabled = !!row2.mailer_enabled;
        mailerMode = row2.mailer_mode || "api";
      }
    } catch {
      // DB not ready yet
    }
  }

  return (
    <MailerPortal
      enabled={mailerEnabled}
      mode={mailerMode}
      webAppUrl=""
    />
  );
}
