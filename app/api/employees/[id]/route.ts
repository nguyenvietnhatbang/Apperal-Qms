import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { employeeSchema } from "@/features/employees/types/employee-types";
import { deleteEmployee, getEmployee, updateEmployee } from "@/features/employees/services/employee-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const { id } = await params;
    return ok(await getEmployee(id));
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canUpdate");
    const { id } = await params;
    const input = await parseJson(request, employeeSchema);
    return ok(await updateEmployee(id, input));
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canDelete");
    const { id } = await params;
    await deleteEmployee(id);
    return ok({ deleted: true });
  });
}
