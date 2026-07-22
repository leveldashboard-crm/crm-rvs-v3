import SettingsPage from "@/components/settings/SettingsPage";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewSettings } from "@/lib/rbac";

export const metadata = {
  title: "Settings — DelegateConnect",
  description: "Configure Google Apps Script, Drive folder, and Sheets integration",
};

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewSettings(role)) {
    redirect("/");
  }
  return <SettingsPage />;
}

