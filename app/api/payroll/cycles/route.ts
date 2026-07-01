import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { payrollCycleSchema } from "@/features/payroll/types/payroll-types";
import {
  createPayrollCycle,
  listPayrollCycles,
} from "@/features/payroll/services/payroll-cycle-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const result = await listPayrollCycles(new URL(request.url).searchParams);
    return listOk(result.data, result.pagination);
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    const user = await requireModulePermission("payroll", "canCreate");
    const input = await parseJson(request, payrollCycleSchema);
    return ok(await createPayrollCycle(input, user.userId), { status: 201 });
  });
}
