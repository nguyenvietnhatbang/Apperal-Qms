import { redirect } from "next/navigation";
import { requireModulePermission } from "@/lib/auth-session";
import { AuthAdmin } from "@/app/auth/_components/auth-admin";

export default async function AuthPage() {
  const user = await requireModulePermission("auth", "canView").catch(() => null);
  if (!user) redirect("/modules");
  return <AuthAdmin />;
}
