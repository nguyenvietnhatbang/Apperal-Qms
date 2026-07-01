'use client';

import React from 'react';

export interface Employee {
  id: string;
  name?: string;
  full_name: string;
  gender: string;
  department?: string;
  department_name: string;
  position: string;
  join_date: string | null;
  total_salary: number;
  insurance_salary: number;
  basic_salary: number;
  allowance_title: number;
  allowance_responsibility: number;
  allowance_seniority: number;
  allowance_safety: number;
  allowance_phone: number;
  allowance_other: number;
  allowance_travel: number;
  allowance_housing: number;
  children_count?: number;
  children_under_6_count: number;
  dependents_count: number;
  is_union_member: boolean;
  is_female?: boolean;
}

interface EmployeeListProps {
  employees: Employee[];
  total: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  search: string;
  department: string;
  departments: string[];
  onChangeParams: (params: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; search?: string; department?: string }) => void;
  onEdit: (emp: Employee) => void;
  formatMoney: (val: any) => string;
}

export default function EmployeeList({
  employees,
  total,
  page,
  limit,
  sortBy,
  sortOrder,
  search,
  department,
  departments,
  onChangeParams,
  onEdit,
  formatMoney
}: EmployeeListProps) {

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
      department: '',
      page: 1,
      sortBy: 'id',
      sortOrder: 'ASC'
    });
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search box */}
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên, mã số, phòng ban..."
              value={search}
              onChange={e => onChangeParams({ search: e.target.value, page: 1 })}
              className="block w-full rounded-xl bg-slate-950/40 border border-white/10 py-2 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all"
            />
          </div>

          {/* Department filter */}
          <select
            value={department}
            onChange={e => onChangeParams({ department: e.target.value, page: 1 })}
            className="bg-slate-900 border border-white/10 text-white rounded-xl text-sm px-3.5 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer w-full sm:w-48"
          >
            <option value="">Tất cả bộ phận</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Reset Filters button */}
          {(search || department || sortBy !== 'id' || sortOrder !== 'ASC') && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel rounded-2xl border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.04] text-left">
            <thead className="bg-slate-950/20 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>
                  Mã NV {renderSortIcon('id')}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                  Họ & Tên {renderSortIcon('name')}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('department')}>
                  Bộ phận / Chức danh {renderSortIcon('department')}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('total_salary')}>
                  Tổng lương (100%) {renderSortIcon('total_salary')}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('insurance_salary')}>
                  Lương đóng BH {renderSortIcon('insurance_salary')}
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => handleSort('basic_salary')}>
                  Lương cơ bản {renderSortIcon('basic_salary')}
                </th>
                <th className="px-6 py-4 text-right">Cấu hình</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-sm text-slate-300">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-white">{emp.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{emp.full_name || emp.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{emp.gender === 'male' ? 'Nam' : emp.gender === 'female' ? 'Nữ' : 'Khác'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-300">{emp.department_name || emp.department}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{emp.position}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-indigo-400">{formatMoney(emp.total_salary)}</td>
                  <td className="px-6 py-4 font-mono text-slate-400">{formatMoney(emp.insurance_salary)}</td>
                  <td className="px-6 py-4 font-mono text-slate-400">{formatMoney(emp.basic_salary)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onEdit(emp)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/10 text-xs font-semibold text-indigo-400 transition-all cursor-pointer"
                    >
                      Cài đặt lương
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Không tìm thấy nhân viên nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination controls */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span>Tổng số: <strong className="text-white">{total}</strong> nhân viên</span>
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
