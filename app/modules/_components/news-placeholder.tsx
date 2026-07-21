import { FileText } from "lucide-react";

export default function NewsPlaceholder() {
  return (
    <aside aria-labelledby="workspace-news-heading" className="border-t border-slate-200 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Bảng tin</p>
          <h2 id="workspace-news-heading" className="mt-1 text-xl font-black tracking-tight text-slate-950">Tin tức & thông báo</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Sắp ra mắt</span>
      </div>

      <div className="mt-5 flex min-h-52 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-black text-slate-900">Chưa có nội dung mới</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Các bài viết, thông báo và tài liệu vận hành sẽ được quản trị viên bổ sung tại đây.
        </p>
      </div>
    </aside>
  );
}
