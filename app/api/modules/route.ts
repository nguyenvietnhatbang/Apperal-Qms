import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/route-helpers";
import { requireUser } from "@/lib/auth-session";
import { getActiveModulesForUser } from "@/features/auth/services/auth-service";

export async function GET() {
  return apiHandler(async () => {
    const user = await requireUser();
    return ok(await getActiveModulesForUser(user.userId));
  });
}
