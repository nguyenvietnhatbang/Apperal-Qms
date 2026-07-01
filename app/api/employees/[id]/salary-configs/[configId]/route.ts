import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { salaryConfigSchema } from "@/features/employees/types/employee-types";
import {
  deleteSalaryConfig,
  updateSalaryConfig,
} from "@/features/employees/services/salary-config-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; configId: string }> },
) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canUpdate");
    const { id, configId } = await params;
    const input = await parseJson(request, salaryConfigSchema);
    return ok(await updateSalaryConfig(id, configId, input));
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; configId: string }> },
) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canDelete");
    const { id, configId } = await params;
    await deleteSalaryConfig(id, configId);
    return ok({ deleted: true });
  });
}
