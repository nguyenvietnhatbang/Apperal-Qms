import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth-session";
import { PayrollAdmin } from "@/app/payroll/_components/payroll-admin";

export default async function PayrollPage() {
  const user = await requireModulePermission("payroll", "canView").catch(() => null);
  if (!user) redirect("/modules");
  return <PayrollAdmin />;
}
