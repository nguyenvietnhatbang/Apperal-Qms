import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PersonalService } from "@/features/personal/services/personal-service";
import type { PersonalOverview } from "@/features/personal/types";
import { getCurrentPayrollMonth } from "@/features/personal/month";
import PersonalWorkspace from "../_components/personal-workspace";

export default async function PersonalAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.personal?.view) redirect("/modules");
  if (!user.employeeId) redirect("/modules");

  const initialMonth = getCurrentPayrollMonth();
  const overview = await PersonalService.getOverview(user.employeeId, user.factoryId, initialMonth);
  if (!overview) redirect("/modules");
  return <PersonalWorkspace user={user} overview={overview as PersonalOverview} initialMonth={initialMonth} initialView="attendance" />;
}
