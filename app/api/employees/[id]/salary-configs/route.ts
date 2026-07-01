import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { salaryConfigSchema } from "@/features/employees/types/employee-types";
import {
  createSalaryConfig,
  listSalaryConfigs,
} from "@/features/employees/services/salary-config-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const { id } = await params;
    return ok(await listSalaryConfigs(id));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canCreate");
    const { id } = await params;
    const input = await parseJson(request, salaryConfigSchema);
    return ok(await createSalaryConfig(id, input), { status: 201 });
  });
}
