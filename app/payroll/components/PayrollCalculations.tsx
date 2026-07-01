'use client';

import React from 'react';

export interface PayrollCalculation {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  total_workdays: string;
  leave_days: string;
  holiday_days: string;
  ot_hours_regular: string;
  ot_hours_sunday: string;
  ot_hours_holiday: string;
  salary_workdays: string;
  salary_leave_holiday: string;
  allowance_title: string;
  allowance_responsibility: string;
  allowance_seniority: string;
  allowance_safety: string;
  allowance_phone: string;
  allowance_other: string;
  allowance_travel: string;
  allowance_housing: string;
  allowance_female: string;
  allowance_children: string;
  ot_pay_regular: string;
  ot_pay_sunday: string;
  ot_pay_holiday: string;
  total_income: string;
  deduction_social_insurance: string;
  deduction_union: string;
  taxable_income: string;
  tax_amount: string;
  net_salary: string;
  advance_1: string;
  advance_2: string;
  remaining_salary: string;
  emp_total_salary: number;
  emp_insurance_salary: number;
}

interface PayrollCalculationsProps {
  calculations: PayrollCalculation[];
  total: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  search: string;
  onChangeParams: (params: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; search?: string }) => void;
  isCalculating: boolean;
  isFinalized: boolean;
  onCalculate: () => void;
  onFinalize: () => void;
  onSelectSlip: (calc: PayrollCalculation) => void;
  formatMoney: (val: any) => string;
}

export default function PayrollCalculations({
  calculations,
  total,
  page,
  limit,
  sortBy,
  sortOrder,
  search,
  onChangeParams,
  isCalculating,
  isFinalized,
  onCalculate,
  onFinalize,
  onSelectSlip,
  formatMoney
}: PayrollCalculationsProps) {

  const handleSort = (field: string) => {
    if (sortBy === field) {
      onChangeParams({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC', page: 1 });
    } else {
      onChangeParams({ sortBy: field, sortOrder: 'ASC', page: 1 });
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-600 inline ml-1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    }
    return sortOrder === 'ASC' ? (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-400 inline ml-1">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-400 inline ml-1">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    );
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const handleReset = () => {
    onChangeParams({
      search: '',
      page: 1,
      sortBy: 'employee_id',
      sortOrder: 'ASC'
    });
  };

  return (
    <div className="space-y-6">
      {/* Control Actions Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-6 rounded-2xl glass-panel border-white/[0.08]">
        <div>
          <h3 className="text-base font-bold text-white mb-1">Tính toán lương hàng tháng</h3>
          <p className="text-xs text-slate-400">
            Chạy tiến trình tính lương tự động dựa trên dữ liệu chấm công, cấu hình lương nhân viên và quy tắc chung.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!isFinalized && (
            <>
              <button
                onClick={onCalculate}
                disabled={isCalculating}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20 animate-pulse"
              >
                {isCalculating ? 'Đang tính...' : 'Chạy tính lương'}
              </button>
              
              {calculations.length > 0 && (
                <button
                  onClick={onFinalize}
                  className="px-4 py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-sm font-semibold text-rose-400 transition-all cursor-pointer"
                >
                  Chốt sổ lương 🔒
                </button>
              )}
            </>
          )}
          {isFinalized && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 text-xs font-semibold text-rose-400 border border-rose-500/20">
              🔒 Bảng lương đã khóa
            </span>
          )}
        </div>
      </div>

      {/* Search & Reset Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h3 className="text-base font-bold text-white">Bảng lương chi tiết</h3>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Lọc theo nhân viên..."
              value={search}
              onChange={e => onChangeParams({ search: e.target.value, page: 1 })}
              className="block w-full rounded-lg bg-slate-950/40 border border-white/10 py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all"
            />
          </div>

          {(search || sortBy !== 'employee_id' || sortOrder !== 'ASC') && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Main Calculations table */}
      <div className="glass-panel rounded-2xl border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.04] text-left select-none">
            <thead className="bg-slate-950/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('employee_id')}>
                  Mã NV {renderSortIcon('employee_id')}
                </th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-white" onClick={() => handleSort('employee_name')}>
                  Họ & Tên {renderSortIcon('employee_name')}
                </th>
                <th className="px-4 py-3.5">Bộ phận</th>
                <th className="px-4 py-3.5 text-center cursor-pointer hover:text-white" onClick={() => handleSort('total_workdays')}>
                  Công làm {renderSortIcon('total_workdays')}
                </th>
                <th className="px-4 py-3.5 text-right">Lương hành chính</th>
                <th className="px-4 py-3.5 text-right">Tăng ca thường</th>
                <th className="px-4 py-3.5 text-right">Tăng ca CN</th>
                <th className="px-4 py-3.5 text-right">Thu nhập phép, lễ</th>
                <th className="px-4 py-3.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('total_income')}>
                  Tổng thu nhập {renderSortIcon('total_income')}
                </th>
                <th className="px-4 py-3.5 text-right">Khấu trừ BHXH (10.5%)</th>
                <th className="px-4 py-3.5 text-right cursor-pointer hover:text-white" onClick={() => handleSort('net_salary')}>
                  Thực nhận {renderSortIcon('net_salary')}
                </th>
                <th className="px-4 py-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs text-slate-300">
              {calculations.map(calc => (
                <tr key={calc.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3.5 font-mono font-semibold text-white">{calc.employee_id}</td>
                  <td className="px-4 py-3.5 font-semibold text-white">{calc.employee_name}</td>
                  <td className="px-4 py-3.5 text-slate-400">{calc.department}</td>
                  <td className="px-4 py-3.5 font-mono text-center font-bold text-slate-200">{calc.total_workdays}</td>
                  <td className="px-4 py-3.5 font-mono text-right">{formatMoney(calc.salary_workdays)}</td>
                  <td className="px-4 py-3.5 font-mono text-right text-amber-500">{formatMoney(calc.ot_pay_regular)}</td>
                  <td className="px-4 py-3.5 font-mono text-right text-rose-400">{formatMoney(calc.ot_pay_sunday)}</td>
                  <td className="px-4 py-3.5 font-mono text-right">{formatMoney(calc.salary_leave_holiday)}</td>
                  <td className="px-4 py-3.5 font-mono text-right font-bold text-indigo-400">{formatMoney(calc.total_income)}</td>
                  <td className="px-4 py-3.5 font-mono text-right text-slate-400">{formatMoney(calc.deduction_social_insurance)}</td>
                  <td className="px-4 py-3.5 font-mono text-right font-bold text-emerald-400">{formatMoney(calc.net_salary)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onSelectSlip(calc)}
                      className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-bold cursor-pointer"
                    >
                      Phiếu Lương
                    </button>
                  </td>
                </tr>
              ))}
              {calculations.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-500">
                    Chưa chạy tính lương cho chu kỳ này hoặc không có dữ liệu chấm công.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculations Pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span>Tổng số: <strong className="text-white">{total}</strong> dòng lương</span>
              <div className="flex items-center gap-1.5">
                <span>Số dòng:</span>
                <select
                  value={limit}
                  onChange={e => onChangeParams({ limit: Number(e.target.value), page: 1 })}
                  className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-white font-semibold focus:outline-none"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => onChangeParams({ page: page - 1 })}
                className="px-2.5 py-1.5 rounded bg-slate-900 border border-white/5 disabled:opacity-30 hover:bg-slate-800 text-white font-semibold cursor-pointer transition-colors"
              >
                Trước
              </button>
              <span>Trang {page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => onChangeParams({ page: page + 1 })}
                className="px-2.5 py-1.5 rounded bg-slate-900 border border-white/5 disabled:opacity-30 hover:bg-slate-800 text-white font-semibold cursor-pointer transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
