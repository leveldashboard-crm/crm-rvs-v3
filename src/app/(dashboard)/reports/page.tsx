import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewReports } from "@/lib/rbac";
import ReportsPage from "@/components/dashboard/ReportsPage";

export const metadata = {
  title: "Reports & BI — ConnectBuild CRM v3",
  description: "Business intelligence, funnel analytics, cohort reports, and data exports",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewReports(role)) redirect("/");
  return <ReportsPage role={role} />;
}
