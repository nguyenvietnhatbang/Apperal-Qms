import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import PersonalAttendance from "../_components/personal-attendance";

export default async function PersonalAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.personal?.view) redirect("/modules");
  return <PersonalAttendance user={user} />;
}
