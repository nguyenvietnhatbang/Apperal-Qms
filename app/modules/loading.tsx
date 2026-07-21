import { Loader2 } from "lucide-react";

export default function ModulesLoading() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-600" />
            <div>
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
            </div>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-7 sm:px-6 sm:py-10">
        <div className="border-b border-slate-200 pb-7">
          <div className="h-4 w-32 rounded bg-blue-100" />
          <div className="mt-4 h-8 w-72 max-w-full rounded bg-slate-200" />
          <div className="mt-3 h-4 w-[460px] max-w-full rounded bg-slate-100" />
        </div>
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
              <div><div className="h-5 w-36 rounded bg-slate-200" /><div className="mt-2 h-4 w-52 rounded bg-slate-100" /></div>
              <div className="h-10 w-44 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="min-h-40 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="h-11 w-11 rounded-xl bg-slate-100" />
                  <div className="mt-4 h-4 w-28 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-full rounded bg-slate-100" />
                </div>
              ))}
          </div>
          <div className="mt-10 border-t border-slate-200 pt-8">
            <div className="h-4 w-20 rounded bg-slate-100" />
            <div className="mt-2 h-5 w-44 rounded bg-slate-200" />
            <div className="mt-5 min-h-52 rounded-xl border border-dashed border-slate-200 bg-white" />
          </div>
        </div>
      </main>
    </div>
  );
}
