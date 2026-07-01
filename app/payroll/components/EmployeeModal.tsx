'use client';

import React from 'react';
import { Employee } from './EmployeeList';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeForm: Partial<Employee>;
  setEmployeeForm: React.Dispatch<React.SetStateAction<Partial<Employee>>>;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EmployeeModal({
  isOpen,
  onClose,
  employeeForm,
  setEmployeeForm,
  onSubmit
}: EmployeeModalProps) {
  if (!isOpen) return null;

  const currentName = employeeForm.full_name || employeeForm.name || '';
  const currentDept = employeeForm.department_name || employeeForm.department || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-2xl w-full rounded-2xl border-white/[0.08] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            Cài đặt hồ sơ & lương: {currentName} ({employeeForm.id})
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
        
        <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[550px] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Họ & Tên</label>
              <input
                type="text"
                required
                value={currentName}
                onChange={e => setEmployeeForm(prev => ({ ...prev, full_name: e.target.value, name: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Giới tính</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={employeeForm.gender === 'Nam' || employeeForm.gender === 'male'}
                    onChange={() => setEmployeeForm(prev => ({ ...prev, gender: 'male', is_female: false }))}
                    className="h-4 w-4 bg-slate-900 border-white/10 text-indigo-600"
                  />
                  Nam
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={employeeForm.gender === 'Nữ' || employeeForm.gender === 'female'}
                    onChange={() => setEmployeeForm(prev => ({ ...prev, gender: 'female', is_female: true }))}
                    className="h-4 w-4 bg-slate-900 border-white/10 text-indigo-600"
                  />
                  Nữ
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phòng ban</label>
              <input
                type="text"
                required
                value={currentDept}
                onChange={e => setEmployeeForm(prev => ({ ...prev, department_name: e.target.value, department: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chức vụ</label>
              <input
                type="text"
                required
                value={employeeForm.position || ''}
                onChange={e => setEmployeeForm(prev => ({ ...prev, position: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Cấu hình lương & bảo hiểm</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tổng lương (100%)</label>
              <input
                type="number"
                value={employeeForm.total_salary || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, total_salary: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Lương đóng BH</label>
              <input
                type="number"
                value={employeeForm.insurance_salary || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, insurance_salary: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Lương cơ bản</label>
              <input
                type="number"
                value={employeeForm.basic_salary || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, basic_salary: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Các khoản phụ cấp & thưởng (VND)</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Chức danh</label>
              <input
                type="number"
                value={employeeForm.allowance_title || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_title: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Trách nhiệm</label>
              <input
                type="number"
                value={employeeForm.allowance_responsibility || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_responsibility: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Thâm niên</label>
              <input
                type="number"
                value={employeeForm.allowance_seniority || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_seniority: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC An toàn VSSV</label>
              <input
                type="number"
                value={employeeForm.allowance_safety || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_safety: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Điện thoại</label>
              <input
                type="number"
                value={employeeForm.allowance_phone || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_phone: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC đi lại (xăng xe)</label>
              <input
                type="number"
                value={employeeForm.allowance_travel || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_travel: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Nhà ở</label>
              <input
                type="number"
                value={employeeForm.allowance_housing || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_housing: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PC Khác</label>
              <input
                type="number"
                value={employeeForm.allowance_other || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, allowance_other: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-1.5 px-3 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Gia cảnh & Đoàn viên công đoàn</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Số con dưới 6 tuổi</label>
              <input
                type="number"
                value={employeeForm.children_under_6_count !== undefined ? employeeForm.children_under_6_count : (employeeForm.children_count || 0)}
                onChange={e => setEmployeeForm(prev => ({ ...prev, children_under_6_count: Number(e.target.value), children_count: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none"
                placeholder="Ví dụ: 1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Số người phụ thuộc (Thuế)</label>
              <input
                type="number"
                value={employeeForm.dependents_count || 0}
                onChange={e => setEmployeeForm(prev => ({ ...prev, dependents_count: Number(e.target.value) }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2 px-3 text-white text-sm focus:outline-none"
                placeholder="Ví dụ: 2"
              />
            </div>

            <div className="flex items-center pt-8">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={employeeForm.is_union_member !== false}
                  onChange={e => setEmployeeForm(prev => ({ ...prev, is_union_member: e.target.checked }))}
                  className="h-4 w-4 bg-slate-900 border-white/10 text-indigo-600 focus:ring-indigo-600/20 rounded"
                />
                <span className="text-sm font-semibold text-slate-200">Đoàn viên công đoàn</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06] sticky bottom-0 bg-slate-950/80 backdrop-blur">
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
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
