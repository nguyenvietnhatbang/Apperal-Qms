import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollCycleService } from "@/features/payroll/services/payroll-cycle-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import { EmployeeService } from "@/features/employees/services/employee-service";
import { getAccessibleFactories, resolveAccessibleFactoryId } from "@/lib/factory-scope";
import PayrollDashboardClient from "./_components/payroll-dashboard-client";

interface PayrollPageProps {
  searchParams: Promise<{ factoryId?: string }>;
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const hasAccess = await PermissionService.hasModuleAccess("payroll");
  if (!hasAccess) {
    redirect("/modules");
  }

  const params = await searchParams;
  const accessibleFactories = await getAccessibleFactories(user);
  const factoryId = await resolveAccessibleFactoryId(user, params.factoryId);

  if (!params.factoryId) {
    redirect(`/payroll?factoryId=${factoryId}`);
  }

  const activeFactory = accessibleFactories.find((factory: any) => factory.id === factoryId);

  // Preload data on server side
  const cycles = await PayrollCycleService.getCycles(factoryId);
  const employees = await EmployeeService.getEmployees(factoryId);
  const rules = await PayrollRuleService.getRules(factoryId);

  return (
    <PayrollDashboardClient
      currentUser={user}
      initialCycles={cycles}
      initialEmployees={employees}
      initialRules={rules}
      factoryId={factoryId}
      activeFactory={activeFactory}
      accessibleFactories={accessibleFactories}
    />
  );
}
