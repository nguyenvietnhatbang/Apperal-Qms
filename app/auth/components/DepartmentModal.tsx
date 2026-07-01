'use client';

import React from 'react';

interface DeptFormState {
  id: string | null;
  name: string;
  permissions: string[];
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  deptForm: DeptFormState;
  setDeptForm: React.Dispatch<React.SetStateAction<DeptFormState>>;
  onSave: (e: React.FormEvent) => void;
}

export default function DepartmentModal({
  isOpen,
  onClose,
  deptForm,
  setDeptForm,
  onSave
}: DepartmentModalProps) {
  if (!isOpen) return null;

  const handleTogglePermission = (perm: string) => {
    setDeptForm(prev => {
      const exists = prev.permissions.includes(perm);
      const newPerms = exists 
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: newPerms };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-md w-full rounded-2xl border-white/[0.08] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {deptForm.id ? 'Cập nhật phòng ban' : 'Thêm phòng ban mới'}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={onSave} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên phòng ban</label>
            <input
              type="text"
              required
              disabled={deptForm.name === 'Ban Giám Đốc'}
              value={deptForm.name}
              onChange={e => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              placeholder="Ví dụ: Kế Toán"
            />
          </div>

          {deptForm.name !== 'Ban Giám Đốc' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Phân quyền chức năng</label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={deptForm.permissions.includes('auth')}
                    onChange={() => handleTogglePermission('auth')}
                    className="mt-0.5 h-4 w-4 rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-indigo-600/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">Quản lý Phân Quyền (auth)</span>
                    <span className="text-xs text-slate-400 mt-0.5">Cho phép cấu hình các phòng ban, phân quyền và tạo tài khoản đăng nhập.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={deptForm.permissions.includes('payroll')}
                    onChange={() => handleTogglePermission('payroll')}
                    className="mt-0.5 h-4 w-4 rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-indigo-600/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">Chấm Công & Tính Lương (payroll)</span>
                    <span className="text-xs text-slate-400 mt-0.5">Cho phép quản lý cấu hình lương nhân viên, import bảng chấm công và tính lương.</span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-indigo-500/5 p-4 border border-indigo-500/10 text-xs text-slate-400 leading-relaxed">
              Lưu ý: Vai trò cốt lõi <strong>Ban Giám Đốc</strong> mặc định có toàn bộ quyền trong hệ thống và không thể sửa đổi hoặc xóa quyền.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
