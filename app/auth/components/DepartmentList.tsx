'use client';

import React from 'react';

export interface Department {
  id: string;
  code?: string;
  name: string;
  is_admin?: boolean;
  permissions: string[];
}

interface DepartmentListProps {
  departments: Department[];
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
}

export default function DepartmentList({ departments, onEdit, onDelete }: DepartmentListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {departments.map(d => (
        <div key={d.id} className="glass-panel rounded-2xl p-6 border-white/[0.06] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-base font-bold text-white">{d.name}</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(d)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Sửa
                </button>
                {d.code !== 'admin' && d.code !== 'hr_payroll' && d.name !== 'Ban Giám Đốc' && (
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-400 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Phân quyền module:</span>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  d.name === 'Ban Giám Đốc' || d.permissions.includes('auth')
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-slate-900/60 text-slate-600 border-slate-800'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${d.name === 'Ban Giám Đốc' || d.permissions.includes('auth') ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                  Quản lý phân quyền (auth)
                </span>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  d.name === 'Ban Giám Đốc' || d.permissions.includes('payroll')
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-900/60 text-slate-600 border-slate-800'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${d.name === 'Ban Giám Đốc' || d.permissions.includes('payroll') ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                  Chấm công & Lương (payroll)
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
      {departments.length === 0 && (
        <div className="col-span-full py-12 text-center text-slate-500 text-sm">
          Không có phòng ban nào được lập.
        </div>
      )}
    </div>
  );
}
