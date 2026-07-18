"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Vui lòng nhập đầy đủ mã đăng nhập và mật khẩu.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
        setIsLoading(false);
        return;
      }

      router.replace("/modules");
    } catch (err) {
      console.error("Login error:", err);
      setError("Đã xảy ra lỗi kết nối. Vui lòng kiểm tra mạng.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section
        className="relative hidden min-h-screen overflow-hidden bg-slate-950 px-16 py-16 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <Image
          src="/software-operations-login-bg.png"
          alt=""
          fill
          sizes="54vw"
          quality={65}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-slate-950/90 via-slate-950/78 to-slate-950/34" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-[70px] w-[70px] items-center justify-center bg-emerald-600 text-2xl font-black tracking-tight text-white">
              CT
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight">IRT Eco</p>
              <p className="mt-1 text-sm font-medium text-slate-300">Internal Operations</p>
            </div>
          </div>

          <div className="mt-16 max-w-2xl">
            <h1 className="text-5xl font-black leading-tight tracking-tight">
              Phần mềm quản lý công việc
              <span className="mt-2 block text-center text-blue-500">All - In - One</span>
            </h1>
            <p className="mt-5 text-center text-xl font-medium leading-8 text-slate-200">
              Accomplish Instantly Onywhere
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-5 text-slate-300">
          {[
            "Phân quyền quản trị theo module",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-base font-medium">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <main className="flex min-h-screen flex-col bg-slate-50 px-6 py-8 sm:px-10 lg:px-20">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center bg-emerald-600 text-base font-black text-white">
            CT
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-slate-950">IRT Eco</p>
            <p className="text-xs font-medium text-slate-500">Internal Operations</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="mb-10">
              <h2 className="text-4xl font-black tracking-tight text-slate-950">Chào mừng trở lại</h2>
              <p className="mt-4 max-w-md text-lg leading-7 text-slate-600">
                Nhập thông tin đăng nhập để truy cập vào hệ thống quản lý nội bộ.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Tài khoản <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    placeholder="admin"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-medium text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Nhập mật khẩu"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-12 text-base font-medium text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <label className="flex w-fit items-center gap-3 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-3 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

            </form>

            <div className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
              Dữ liệu nội bộ được lưu theo phiên làm việc bảo mật
            </div>
          </div>
        </div>

        <footer className="text-center text-sm font-medium text-slate-500">
          © 2026 IRT Eco. Bảo mật hệ thống nội bộ.
        </footer>
      </main>
    </div>
  );
}
