import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewWorkforce } from "@/lib/rbac";
import WorkforcePage from "@/components/dashboard/WorkforcePage";

export const metadata = {
  title: "Workforce — ConnectBuild CRM v3",
  description: "Shift scheduling, attendance tracking, and team presence management",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewWorkforce(role)) redirect("/");
  return <WorkforcePage role={role} />;
}
