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

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
          <div className="h-5 w-28 rounded bg-blue-100" />
          <div className="mt-4 h-8 w-72 max-w-full rounded bg-slate-200" />
          <div className="mt-3 h-4 w-[460px] max-w-full rounded bg-slate-100" />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div><div className="h-5 w-36 rounded bg-slate-200" /><div className="mt-2 h-4 w-52 rounded bg-slate-100" /></div>
              <div className="h-10 w-44 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="min-h-36 rounded-xl border border-slate-100 p-4">
                  <div className="h-11 w-11 rounded-xl bg-slate-100" />
                  <div className="mt-4 h-4 w-28 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-full rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="min-h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-28 rounded bg-blue-100" />
            <div className="mt-3 h-5 w-44 rounded bg-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}
