'use client';

import React from 'react';
import { Department } from './DepartmentList';

interface UserFormState {
  id: string | null;
  username: string;
  password: string;
  display_name: string;
  department_id: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userForm: UserFormState;
  setUserForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  departments: Department[];
  onSave: (e: React.FormEvent) => void;
}

export default function UserModal({
  isOpen,
  onClose,
  userForm,
  setUserForm,
  departments,
  onSave
}: UserModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-md w-full rounded-2xl border-white/[0.08] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {userForm.id ? 'Cập nhật tài khoản' : 'Tạo tài khoản mới'}
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
        
        <form onSubmit={onSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên hiển thị</label>
            <input
              type="text"
              required
              value={userForm.display_name}
              onChange={e => setUserForm(prev => ({ ...prev, display_name: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên đăng nhập</label>
            <input
              type="text"
              required
              disabled={userForm.id !== null}
              value={userForm.username}
              onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              placeholder="Ví dụ: vana"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {userForm.id ? 'Mật khẩu mới (Bỏ trống nếu giữ nguyên)' : 'Mật khẩu'}
            </label>
            <input
              type="password"
              required={userForm.id === null}
              value={userForm.password}
              onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Mật khẩu..."
            />
          </div>

          {userForm.username !== 'admin' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phòng ban / Vai trò</label>
              <select
                value={userForm.department_id}
                onChange={e => setUserForm(prev => ({ ...prev, department_id: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Chọn phòng ban...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
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
