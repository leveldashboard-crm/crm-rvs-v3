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

  // Load mailer settings
  let mailerSettings = null;
  try {
    const result = await db.execute(sql`
      SELECT mailer_web_app_url, mailer_mode, mailer_enabled FROM app_settings WHERE id = 1 LIMIT 1
    `);
    const rows = Array.from(result);
    if (rows.length > 0) {
      mailerSettings = rows[0] as {
        mailer_web_app_url: string | null;
        mailer_mode: string | null;
        mailer_enabled: boolean | null;
      };
    }
  } catch (e) {
    console.error("Error loading mailer settings on page:", e);
  }

  return (
    <MailerPortal
      enabled={!!mailerSettings?.mailer_enabled}
      mode={mailerSettings?.mailer_mode || "api"}
      webAppUrl={mailerSettings?.mailer_web_app_url || ""}
    />
  );
}
