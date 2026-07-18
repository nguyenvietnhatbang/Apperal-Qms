import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import PersonalDashboard from "./_components/personal-dashboard";

export default async function PersonalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.personal?.view) redirect("/modules");

  return <PersonalDashboard user={user} />;
}
