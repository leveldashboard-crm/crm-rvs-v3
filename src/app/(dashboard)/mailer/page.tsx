import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import MailerPortal from "@/components/mailer/MailerPortal";
import { redirect } from "next/navigation";
import { normalizeRole } from "@/lib/rbac";

export const metadata = {
  title: "Concierge Mailer — DelegateConnect",
  description: "Send personalised emails and Drive attachments to delegates",
};

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");

  const rawRole = (session?.user as { role?: string } | undefined)?.role ?? "user";
  const role = normalizeRole(rawRole);

  // Allow master_admin, regional_admin, and team_lead
  if (role !== "master_admin" && role !== "regional_admin" && role !== "team_lead") {
    redirect("/");
  }


  // Load mailer settings — default enabled to true for seamless concierge mailer access
  let mailerEnabled = true;
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
      // Keep enabled if true or if default
      if (row.mailer_enabled !== null && row.mailer_enabled !== undefined) {
        mailerEnabled = !!row.mailer_enabled;
      }
      mailerMode = row.mailer_mode || "api";
    }
  } catch {
    // Fallback gracefully
  }

  return (
    <MailerPortal
      enabled={mailerEnabled}
      mode={mailerMode}
      webAppUrl=""
    />
  );
}

