import { ok } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { payrollRuleSchema } from "@/features/payroll/types/payroll-types";
import { updatePayrollRule } from "@/features/payroll/services/payroll-rule-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canUpdate");
    const { id } = await params;
    const input = await parseJson(request, payrollRuleSchema);
    return ok(await updatePayrollRule(id, input));
  });
}
