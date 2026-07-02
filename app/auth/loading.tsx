import { Loader2 } from "lucide-react";

export default function AuthLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-4 md:block">
        <div className="mb-6 h-12 rounded-lg bg-zinc-100" />
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-10 rounded-lg bg-zinc-100" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div className="h-4 w-64 rounded bg-zinc-200" />
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="h-5 w-28 rounded bg-zinc-200" />
              <div className="mt-4 h-4 w-full rounded bg-zinc-100" />
              <div className="mt-2 h-4 w-2/3 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
