import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { employeeSchema } from "@/features/employees/types/employee-types";
import { createEmployee, listEmployees } from "@/features/employees/services/employee-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const result = await listEmployees(new URL(request.url).searchParams);
    return listOk(result.data, result.pagination);
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canCreate");
    const input = await parseJson(request, employeeSchema);
    return ok(await createEmployee(input), { status: 201 });
  });
}
