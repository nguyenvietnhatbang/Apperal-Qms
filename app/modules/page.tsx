import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth-session";
import { getActiveModulesForUser } from "@/features/auth/services/auth-service";
import { LogoutButton } from "@/app/modules/_components/logout-button";

export default async function ModulesPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  const modules = await getActiveModulesForUser(user.userId);

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Không gian làm việc</div>
            <h1 className="mt-1 text-2xl font-semibold">Chọn module làm việc</h1>
            <p className="mt-1 text-sm text-zinc-600">Xin chào, {user.displayName}</p>
          </div>
          <LogoutButton />
        </header>

        {modules.length ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <Link
                key={module.id}
                className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                href={module.routePath}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{module.name}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{module.description}</p>
              </Link>
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-600">
            Tài khoản chưa được cấp quyền vào module nào.
          </section>
        )}
      </div>
    </main>
  );
}
