'use client';

import React from 'react';

export interface PayrollCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'finalized';
}

interface CycleSelectorProps {
  cycles: PayrollCycle[];
  selectedCycleId: string;
  onSelectCycle: (id: string) => void;
  onOpenCreateModal: () => void;
  onDeleteCycle: () => void;
  session: any;
}

export default function CycleSelector({
  cycles,
  selectedCycleId,
  onSelectCycle,
  onOpenCreateModal,
  onDeleteCycle,
  session
}: CycleSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Selector Dropdown */}
      <select
        value={selectedCycleId}
        onChange={e => onSelectCycle(e.target.value)}
        className="bg-slate-900 border border-white/10 text-white rounded-lg text-xs font-semibold px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
      >
        <option value="">Chọn chu kỳ...</option>
        {cycles.map(c => (
          <option key={c.id} value={c.id}>
            {c.name} {c.status === 'finalized' ? '🔒' : '✍️'}
          </option>
        ))}
      </select>

      {/* Create Button */}
      <button
        onClick={onOpenCreateModal}
        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
        title="Tạo chu kỳ tính lương mới"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Delete Button */}
      {selectedCycleId && (
        <button
          onClick={onDeleteCycle}
          className="px-2.5 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition-all cursor-pointer"
          title="Xóa chu kỳ hiện tại"
        >
          Xóa chu kỳ
        </button>
      )}
    </div>
  );
}
