import { Loader2 } from "lucide-react";

export default function PayrollLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-4 md:block">
        <div className="mb-6 flex items-center gap-3 border-b border-zinc-100 pb-5">
          <div className="h-9 w-9 rounded-lg bg-blue-600" />
          <div>
            <div className="h-4 w-20 rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-28 rounded bg-zinc-100" />
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 rounded-lg bg-zinc-100" />
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div className="h-4 w-72 max-w-full rounded bg-zinc-200" />
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-150 p-4">
              <div className="h-10 w-72 rounded-xl bg-zinc-100" />
              <div className="h-10 w-32 rounded-xl bg-zinc-100" />
            </div>
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-11 rounded bg-zinc-100" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
