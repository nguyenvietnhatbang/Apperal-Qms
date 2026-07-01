import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { getPayrollSlip, listPayrollItems } from "@/features/payroll/services/payroll-slip-service";
import { notFoundError } from "@/lib/errors";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const slip = await getPayrollSlip(id);
      if (!slip) throw notFoundError("Không tìm thấy phiếu lương");
      return ok(slip);
    }
    const result = await listPayrollItems(url.searchParams);
    return listOk(result.data, result.pagination);
  });
}
