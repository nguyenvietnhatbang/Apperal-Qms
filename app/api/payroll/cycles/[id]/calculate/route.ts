import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { calculatePayrollCycle } from "@/features/payroll/services/payroll-calculation-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const user = await requireModulePermission("payroll", "canApprove");
    const { id } = await params;
    return ok(await calculatePayrollCycle(id, user));
  });
}
