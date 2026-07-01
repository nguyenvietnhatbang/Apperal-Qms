import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { userUpdateSchema } from "@/features/admin/types/admin-types";
import { deleteUser, getUser, updateUser } from "@/features/admin/services/user-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canView");
    const { id } = await params;
    return ok(await getUser(id));
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canUpdate");
    const { id } = await params;
    const input = await parseJson(request, userUpdateSchema);
    return ok(await updateUser(id, input));
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("auth", "canDelete");
    const { id } = await params;
    await deleteUser(id);
    return ok({ deleted: true });
  });
}
