import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { userCreateSchema } from "@/features/admin/types/admin-types";
import { createUser, listUsers } from "@/features/admin/services/user-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canView");
    const result = await listUsers(new URL(request.url).searchParams);
    return listOk(result.data, result.pagination);
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canCreate");
    const input = await parseJson(request, userCreateSchema);
    return ok(await createUser(input), { status: 201 });
  });
}
