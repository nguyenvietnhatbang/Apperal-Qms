import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import LeaveRequestsClient from "./_components/leave-requests-client";

export default async function LeaveRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.payroll?.update) redirect("/modules");
  return <LeaveRequestsClient />;
}
