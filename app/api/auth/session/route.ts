import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";

export async function GET() {
  return apiHandler(async () => ok(await getCurrentUser()));
}
