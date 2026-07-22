import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeRole, canViewLeaderboard } from "@/lib/rbac";
import LeaderboardPage from "@/components/dashboard/LeaderboardPage";

export const metadata = {
  title: "Leaderboard — ConnectBuild CRM v3",
  description: "Team performance rankings, streaks, and gamification for Bharat Buildcon 2026",
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const session = await auth();
  const role = normalizeRole((session?.user as { role?: string } | undefined)?.role);
  if (!canViewLeaderboard(role)) redirect("/");
  return <LeaderboardPage role={role} />;
}
