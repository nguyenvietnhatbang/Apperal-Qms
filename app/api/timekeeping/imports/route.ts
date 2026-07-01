import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { validationError } from "@/lib/errors";
import {
  importAttendance,
  listAttendanceImports,
} from "@/features/timekeeping/services/attendance-import-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    return ok(await listAttendanceImports(new URL(request.url).searchParams));
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    const user = await requireModulePermission("payroll", "canCreate");
    const formData = await request.formData();
    const payrollCycleId = String(formData.get("payrollCycleId") ?? "");
    const file = formData.get("file");
    if (!payrollCycleId || !(file instanceof File)) {
      throw validationError("Vui lòng chọn chu kỳ và file chấm công");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return ok(await importAttendance(payrollCycleId, file.name, buffer, user), { status: 201 });
  });
}
