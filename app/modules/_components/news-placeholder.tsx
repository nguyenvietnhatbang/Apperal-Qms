import { BellRing, FileText } from "lucide-react";

export default function NewsPlaceholder() {
  return (
    <aside aria-labelledby="workspace-news-heading" className="flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-blue-700">
            <BellRing className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">Cập nhật nội bộ</p>
          </div>
          <h2 id="workspace-news-heading" className="mt-2 text-lg font-black tracking-tight text-slate-950">Tin tức & thông báo</h2>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Sắp ra mắt</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-black text-slate-900">Khu vực đang được chuẩn bị</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Các bài viết, thông báo và tài liệu vận hành sẽ được quản trị viên bổ sung tại đây.
        </p>
      </div>
    </aside>
  );
}
