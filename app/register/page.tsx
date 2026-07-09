"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock, Mail, User, UserRound } from "lucide-react";

interface RegisterError {
  code: string;
  message: string;
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<RegisterError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || { code: "REGISTER_FAILED", message: "Đăng ký thất bại. Vui lòng thử lại." });
        return;
      }

      setIsRegistered(true);
    } catch (err) {
      console.error("Register error:", err);
      setError({ code: "NETWORK_ERROR", message: "Đã xảy ra lỗi kết nối. Vui lòng kiểm tra mạng." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950 sm:px-10">
      <div className="w-full max-w-xl">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại đăng nhập
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center bg-emerald-600 text-lg font-black text-white">
            CT
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight">IRT Eco</p>
            <p className="text-sm font-medium text-slate-500">Internal Operations</p>
          </div>
        </div>

        {isRegistered ? (
          <section className="rounded-lg border border-emerald-200 bg-white p-8 shadow-sm">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Đã gửi đăng ký</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Tài khoản của bạn đã được tạo ở trạng thái chờ kích hoạt. Vui lòng liên hệ quản trị viên để được cấp
              quyền truy cập hệ thống.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
            >
              Về trang đăng nhập
            </Link>
          </section>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8">
              <h1 className="text-3xl font-black tracking-tight">Đăng ký tài khoản mới</h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Tạo tài khoản người dùng nội bộ. Quản trị viên sẽ kích hoạt tài khoản trước khi bạn đăng nhập.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error.message}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
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
                    placeholder="nguyenvana"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                    placeholder="Nguyễn Văn A"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    placeholder="email@congty.com"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="email"
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Tối thiểu 8 ký tự"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-base font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Đang gửi đăng ký...</span>
                  </>
                ) : (
                  <span>Đăng ký</span>
                )}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
