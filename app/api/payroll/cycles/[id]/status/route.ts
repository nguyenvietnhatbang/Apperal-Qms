import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { cycleStatusSchema } from "@/features/payroll/types/payroll-types";
import { transitionPayrollCycle } from "@/features/payroll/services/payroll-cycle-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const user = await requireModulePermission("payroll", "canApprove");
    const { id } = await params;
    const input = await parseJson(request, cycleStatusSchema);
    return ok(await transitionPayrollCycle(id, input.status, user));
  });
}
