import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PersonalService } from "@/features/personal/services/personal-service";
import type { PersonalOverview } from "@/features/personal/types";
import PersonalDashboard from "./_components/personal-dashboard";

export default async function PersonalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.personal?.view) redirect("/modules");
  if (!user.employeeId) redirect("/modules");

  const overview = await PersonalService.getOverview(user.employeeId, user.factoryId);
  if (!overview) redirect("/modules");

  return <PersonalDashboard user={user} initialOverview={overview as PersonalOverview} />;
}
