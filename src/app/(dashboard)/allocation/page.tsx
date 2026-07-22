import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewAllocation } from "@/lib/rbac";
import AllocationPage from "@/components/dashboard/AllocationPage";

export const metadata = {
  title: "Task Allocation — ConnectBuild CRM v3",
  description: "Create and manage task batches, assign delegates to callers, track completion",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewAllocation(role)) redirect("/");
  return <AllocationPage role={role} />;
}
