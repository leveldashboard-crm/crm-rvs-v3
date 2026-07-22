import { auth } from "@/auth";
import DashboardPage from "@/components/dashboard/DashboardPage";
import { redirect } from "next/navigation";
import { normalizeRole, canViewDashboard } from "@/lib/rbac";

export const metadata = {
  title: "Command Center — ConnectBuild CRM v3",
  description: "Master Admin Command Center: Live KPIs, team activity, allocation, and analytics for Bharat Buildcon 2026",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);

  // Callers and analysts don't see the command center — redirect to their primary view
  if (role === "caller") redirect("/travel");
  if (role === "analyst") redirect("/reports");
  if (!canViewDashboard(role)) redirect("/travel");

  return <DashboardPage role={role} />;
}
