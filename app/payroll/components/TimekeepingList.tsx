'use client';

import React, { useRef, useState } from 'react';

export interface TimekeepingRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  day_of_week: string;
  clock_in_1: string;
  clock_out_1: string;
  clock_in_2: string;
  clock_out_2: string;
  clock_in_3: string;
  clock_out_3: string;
  work_count: string;
  work_hours: string;
  ot_hours_regular: string;
  ot_hours_sunday: string;
  ot_hours_holiday: string;
  total_hours: string;
  shift_name: string;
  symbol_code: string;
}

interface TimekeepingListProps {
  records: TimekeepingRecord[];
  total: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  search: string;
  onChangeParams: (params: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC'; search?: string }) => void;
  isFinalized: boolean;
  selectedCycleId: string;
  onImportSuccess: (msg: string) => void;
  onImportError: (msg: string) => void;
}

export default function TimekeepingList({
  records,
  total,
  page,
  limit,
  sortBy,
  sortOrder,
  search,
  onChangeParams,
  isFinalized,
  selectedCycleId,
  onImportSuccess,
  onImportError
}: TimekeepingListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    onImportSuccess('');
    onImportError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        onImportError('Không đọc được nội dung tệp.');
        setIsImporting(false);
        return;
      }

      try {
        const res = await fetch('/api/timekeeping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cycleId: selectedCycleId,
            csvContent: text
          })
        });

        const data = await res.json();
        if (!res.ok) {
          onImportError(data.error || 'Lỗi khi nhập dữ liệu chấm công.');
        } else {
          onImportSuccess(`Thành công: Nhập ${data.importedCount} dòng chấm công. Tạo mới ${data.newEmployeesCount} hồ sơ nhân viên.`);
          onChangeParams({ page: 1 }); // refresh table
        }
      } catch (err) {
        onImportError('Lỗi kết nối đến máy chủ.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleReset = () => {
    onChangeParams({
      search: '',
      page: 1,
      sortBy: 'date',
      sortOrder: 'ASC'
    });
  };

  return (
    <div className="space-y-6">
      {/* CSV Import */}
      {!isFinalized && (
        <div className="p-6 rounded-2xl glass-panel border-white/[0.08]">
          <h3 className="text-base font-bold text-white mb-2">Nhập bảng chấm công từ Excel (Mẫu CSV)</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Chọn tệp chấm công được xuất từ máy chấm công. Hệ thống sẽ tự động phân tích ca làm việc, tính toán tổng số công, giờ làm việc, và giờ tăng ca của từng nhân viên theo ngày.
          </p>

          <div className="flex items-start gap-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              onChange={handleImport}
              className="hidden"
            />
            <button
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-50"
            >
              {isImporting ? 'Đang nhập công...' : 'Chọn tệp CSV nhập công'}
            </button>
          </div>
        </div>
      )}

      {/* Search & Reset Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h3 className="text-base font-bold text-white">Chi tiết chấm công đã làm sạch</h3>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Lọc theo mã số hoặc tên NV..."
              value={search}
              onChange={e => onChangeParams({ search: e.target.value, page: 1 })}
              className="block w-full rounded-lg bg-slate-950/40 border border-white/10 py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all"
            />
          </div>

          {(search || sortBy !== 'date' || sortOrder !== 'ASC') && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="min-w-full divide-y divide-white/[0.04] text-left select-none">
            <thead className="bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('employee_id')}>
                  Mã NV {renderSortIcon('employee_id')}
                </th>
                <th className="px-4 py-3 bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('employee_name')}>
                  Họ & Tên {renderSortIcon('employee_name')}
                </th>
                <th className="px-4 py-3 bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('date')}>
                  Ngày {renderSortIcon('date')}
                </th>
                <th className="px-4 py-3 bg-slate-900">Vào/Ra 1</th>
                <th className="px-4 py-3 bg-slate-900">Vào/Ra 2</th>
                <th className="px-4 py-3 bg-slate-900 text-center cursor-pointer hover:text-white" onClick={() => handleSort('work_count')}>
                  Công {renderSortIcon('work_count')}
                </th>
                <th className="px-4 py-3 text-center bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('work_hours')}>
                  Giờ {renderSortIcon('work_hours')}
                </th>
                <th className="px-4 py-3 text-center bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('ot_hours_regular')}>
                  TC Thường {renderSortIcon('ot_hours_regular')}
                </th>
                <th className="px-4 py-3 text-center bg-slate-900 cursor-pointer hover:text-white" onClick={() => handleSort('ot_hours_sunday')}>
                  TC Chủ nhật {renderSortIcon('ot_hours_sunday')}
                </th>
                <th className="px-4 py-3 text-center bg-slate-900">Ca</th>
                <th className="px-4 py-3 text-center bg-slate-900">Ký hiệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs text-slate-300">
              {records.map(tk => (
                <tr key={tk.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-white">{tk.employee_id}</td>
                  <td className="px-4 py-3 text-slate-200">{tk.employee_name}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {new Date(tk.date).toLocaleDateString('vi-VN')} ({tk.day_of_week})
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {tk.clock_in_1 && tk.clock_out_1 ? `${tk.clock_in_1.substring(0, 5)} - ${tk.clock_out_1.substring(0, 5)}` : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {tk.clock_in_2 && tk.clock_out_2 ? `${tk.clock_in_2.substring(0, 5)} - ${tk.clock_out_2.substring(0, 5)}` : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-center font-bold text-indigo-400">{tk.work_count}</td>
                  <td className="px-4 py-3 font-mono text-center">{tk.work_hours}</td>
                  <td className="px-4 py-3 font-mono text-center text-amber-500">{tk.ot_hours_regular !== '0' && Number(tk.ot_hours_regular) > 0 ? tk.ot_hours_regular : '-'}</td>
                  <td className="px-4 py-3 font-mono text-center text-rose-400">{tk.ot_hours_sunday !== '0' && Number(tk.ot_hours_sunday) > 0 ? tk.ot_hours_sunday : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                      {tk.shift_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{tk.symbol_code || '-'}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    Chưa có dữ liệu chấm công. Hãy import tệp CSV phía trên.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span>Tổng số: <strong className="text-white">{total}</strong> bản ghi chấm công</span>
              <div className="flex items-center gap-1.5">
                <span>Số dòng:</span>
                <select
                  value={limit}
                  onChange={e => onChangeParams({ limit: Number(e.target.value), page: 1 })}
                  className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-white font-semibold focus:outline-none"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
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
