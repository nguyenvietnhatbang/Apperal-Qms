import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { login } from "@/features/auth/services/auth-service";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  return apiHandler(async () => {
    const input = await parseJson(request, schema);
    return ok(await login(input.username, input.password));
  });
}
