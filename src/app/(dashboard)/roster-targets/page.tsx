import { auth } from "@/auth";
import { normalizeRole, canViewAllocation } from "@/lib/rbac";
import { redirect } from "next/navigation";
import RosterTargetPage from "@/components/dashboard/RosterTargetPage";

export const metadata = {
  title: "Roster & Targets — DelegateConnect",
  description: "Manage weekly operational rosters and long-term 3/6/9-month caller targets",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewAllocation(role)) redirect("/");

  return <RosterTargetPage role={role} />;
}
