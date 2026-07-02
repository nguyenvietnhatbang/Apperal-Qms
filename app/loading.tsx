import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span>Đang tải hệ thống...</span>
      </div>
    </div>
  );
}
