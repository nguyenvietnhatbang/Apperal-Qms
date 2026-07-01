import { ok } from "@/lib/api-response";
import { revokeCurrentSession } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";

export async function POST() {
  return apiHandler(async () => {
    await revokeCurrentSession();
    return ok({ loggedOut: true });
  });
}
