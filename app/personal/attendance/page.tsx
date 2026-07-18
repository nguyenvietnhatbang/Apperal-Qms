import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PersonalService } from "@/features/personal/services/personal-service";
import type { AttendanceRecord } from "@/features/personal/types";
import PersonalAttendance from "../_components/personal-attendance";

function getCurrentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export default async function PersonalAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin && !user.permissions.personal?.view) redirect("/modules");
  if (!user.employeeId) redirect("/modules");

  const initialMonth = getCurrentMonth();
  const attendance = await PersonalService.getAttendance(user.employeeId, user.factoryId, initialMonth);
  return <PersonalAttendance user={user} initialMonth={initialMonth} initialRecords={attendance as AttendanceRecord[]} />;
}
