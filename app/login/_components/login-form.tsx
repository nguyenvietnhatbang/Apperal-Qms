"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!payload.success) {
      setError(payload.error?.message ?? "Đăng nhập thất bại");
      return;
    }

    router.replace("/modules");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <label>
        <span className="mb-1.5 block text-sm font-semibold text-zinc-700">Username</span>
        <input
          className="input"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        <span className="mb-1.5 block text-sm font-semibold text-zinc-700">Password</span>
        <input
          className="input"
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Đăng nhập
      </button>
    </form>
  );
}
