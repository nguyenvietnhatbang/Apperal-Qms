import { Loader2 } from "lucide-react";

export default function ModulesLoading() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 bg-emerald-600" />
            <div>
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
            </div>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="border-b border-slate-200 pb-7">
          <div className="h-7 w-72 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-[420px] max-w-full rounded bg-slate-100" />
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="min-h-[224px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mx-auto h-[68px] w-[68px] rounded-2xl bg-slate-100" />
              <div className="mx-auto mt-6 h-5 w-36 rounded bg-slate-200" />
              <div className="mx-auto mt-4 h-4 w-48 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
