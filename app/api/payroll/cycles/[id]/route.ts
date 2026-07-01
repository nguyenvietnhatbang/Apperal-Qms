import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { payrollCycleSchema } from "@/features/payroll/types/payroll-types";
import {
  deletePayrollCycle,
  getPayrollCycle,
  updatePayrollCycle,
} from "@/features/payroll/services/payroll-cycle-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const { id } = await params;
    return ok(await getPayrollCycle(id));
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canUpdate");
    const { id } = await params;
    const input = await parseJson(request, payrollCycleSchema);
    return ok(await updatePayrollCycle(id, input));
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const user = await requireModulePermission("payroll", "canDelete");
    const { id } = await params;
    await deletePayrollCycle(id, user);
    return ok({ cancelled: true });
  });
}
