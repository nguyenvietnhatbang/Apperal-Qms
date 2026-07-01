import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { departmentSchema } from "@/features/admin/types/admin-types";
import {
  createDepartment,
  listDepartmentOptions,
  listDepartments,
} from "@/features/admin/services/department-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canView");
    const url = new URL(request.url);
    if (url.searchParams.get("options") === "true") return ok(await listDepartmentOptions());
    const result = await listDepartments(url.searchParams);
    return listOk(result.data, result.pagination);
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canCreate");
    const input = await parseJson(request, departmentSchema);
    return ok(await createDepartment(input), { status: 201 });
  });
}
