import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollCycleService } from "@/features/payroll/services/payroll-cycle-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import { EmployeeService } from "@/features/employees/services/employee-service";
import PayrollDashboardClient from "./_components/payroll-dashboard-client";

export default async function PayrollPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const hasAccess = await PermissionService.hasModuleAccess("payroll");
  if (!hasAccess) {
    redirect("/modules");
  }

  // Preload data on server side
  const cycles = await PayrollCycleService.getCycles(user.factoryId);
  const employees = await EmployeeService.getEmployees(user.factoryId);
  const rules = await PayrollRuleService.getRules();

  return (
    <PayrollDashboardClient
      currentUser={user}
      initialCycles={cycles}
      initialEmployees={employees}
      initialRules={rules}
    />
  );
}
