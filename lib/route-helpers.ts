import { handleApiError } from "@/lib/api-response";

export function apiHandler(handler: () => Promise<Response>) {
  return handler().catch(handleApiError);
}
