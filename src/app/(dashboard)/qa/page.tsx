import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewQA } from "@/lib/rbac";
import QAPage from "@/components/dashboard/QAPage";

export const metadata = {
  title: "QA Scorecard — ConnectBuild CRM v3",
  description: "Call quality auditing, scoring rubrics, and caller performance analysis",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewQA(role)) redirect("/");
  return <QAPage role={role} />;
}
