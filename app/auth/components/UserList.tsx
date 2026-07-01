'use client';

import React from 'react';

export interface User {
  id: string;
  username: string;
  display_name: string;
  department_id: string | null;
  department_name: string | null;
  created_at: string;
}

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}

export default function UserList({ users, onEdit, onDelete }: UserListProps) {
  return (
    <div className="glass-panel rounded-2xl border-white/[0.06] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/[0.04] text-left">
          <thead className="bg-slate-950/20 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Tên hiển thị</th>
              <th className="px-6 py-4">Tên đăng nhập</th>
              <th className="px-6 py-4">Phòng ban / Vai trò</th>
              <th className="px-6 py-4">Ngày tạo</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-sm text-slate-300">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-6 py-4 font-semibold text-white">{u.display_name}</td>
                <td className="px-6 py-4 font-mono text-slate-400">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    u.username === 'admin' 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                      : u.department_name 
                        ? 'bg-slate-800 text-slate-300 border-slate-700' 
                        : 'bg-slate-900/50 text-slate-500 border-slate-800'
                  }`}>
                    {u.username === 'admin' ? 'Quyền tối cao' : u.department_name || 'Không có vai trò'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2.5">
                    <button
                      onClick={() => onEdit(u)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      Sửa
                    </button>
                    {u.username !== 'admin' && (
                      <button
                        onClick={() => onDelete(u.id)}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-400 cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                  Không có tài khoản nào được hiển thị.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
