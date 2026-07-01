import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { listAttendanceRecords } from "@/features/timekeeping/services/attendance-import-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    return ok(await listAttendanceRecords(new URL(request.url).searchParams));
  });
}
