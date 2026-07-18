import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PayrollCycleService } from "@/features/payroll/services/payroll-cycle-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import { EmployeeService } from "@/features/employees/services/employee-service";
import { getAccessibleFactories } from "@/lib/factory-scope";
import PayrollDashboardClient from "./_components/payroll-dashboard-client";

interface PayrollPageProps {
  searchParams: Promise<{ factoryId?: string }>;
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const hasAccess = user.isAdmin || Boolean(user.permissions.payroll?.view);
  if (!hasAccess) {
    redirect("/modules");
  }

  const [params, accessibleFactories] = await Promise.all([
    searchParams,
    getAccessibleFactories(user),
  ]);
  const activeFactory = params.factoryId
    ? accessibleFactories.find((factory: any) => factory.id === params.factoryId)
    : accessibleFactories.find((factory: any) => factory.isDefault) || accessibleFactories[0];

  if (!activeFactory) {
    redirect("/modules");
  }

  if (!params.factoryId) {
    redirect(`/payroll?factoryId=${activeFactory.id}`);
  }

  const [cycles, employees, rules] = await Promise.all([
    PayrollCycleService.getCycles(activeFactory.id),
    EmployeeService.getEmployees(activeFactory.id),
    PayrollRuleService.getRules(activeFactory.id),
  ]);

  return (
    <PayrollDashboardClient
      currentUser={user}
      initialCycles={cycles}
      initialEmployees={employees}
      initialRules={rules}
      factoryId={activeFactory.id}
      activeFactory={activeFactory}
      accessibleFactories={accessibleFactories}
    />
  );
}
