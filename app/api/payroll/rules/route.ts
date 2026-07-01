import { ok, listOk } from "@/lib/api-response";
import { requireModulePermission } from "@/lib/auth-session";
import { apiHandler } from "@/lib/route-helpers";
import { parseJson } from "@/lib/validation";
import { payrollRuleSchema } from "@/features/payroll/types/payroll-types";
import { createPayrollRule, listPayrollRules } from "@/features/payroll/services/payroll-rule-service";

export async function GET(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canView");
    const result = await listPayrollRules(new URL(request.url).searchParams);
    return listOk(result.data, result.pagination);
  });
}

export async function POST(request: Request) {
  return apiHandler(async () => {
    await requireModulePermission("payroll", "canCreate");
    const input = await parseJson(request, payrollRuleSchema);
    return ok(await createPayrollRule(input), { status: 201 });
  });
}
