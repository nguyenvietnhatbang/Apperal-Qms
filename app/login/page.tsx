import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { LoginForm } from "@/app/login/_components/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/modules");

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-4 py-8 text-zinc-950">
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Truy cập nội bộ</div>
              <h1 className="text-xl font-semibold">Đăng nhập hệ thống</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600">Sử dụng tài khoản nội bộ để vào các module được cấp quyền.</p>
        </div>
        <div className="mt-6">
          <div className="px-6 pb-6">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
