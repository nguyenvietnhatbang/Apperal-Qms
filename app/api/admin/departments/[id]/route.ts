import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { departmentSchema } from "@/features/admin/types/admin-types";
import {
  deleteDepartment,
  getDepartment,
  updateDepartment,
} from "@/features/admin/services/department-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canView");
    const { id } = await params;
    return ok(await getDepartment(id));
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canUpdate");
    const { id } = await params;
    const input = await parseJson(request, departmentSchema);
    return ok(await updateDepartment(id, input));
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canDelete");
    const { id } = await params;
    await deleteDepartment(id);
    return ok({ deleted: true });
  });
}
