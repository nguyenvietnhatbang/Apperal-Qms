'use client';

import React, { useEffect } from 'react';

interface CycleFormState {
  year: string;
  month: string;
  startDate: string;
  endDate: string;
}

interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCycleForm: CycleFormState;
  setNewCycleForm: React.Dispatch<React.SetStateAction<CycleFormState>>;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CycleModal({
  isOpen,
  onClose,
  newCycleForm,
  setNewCycleForm,
  onSubmit
}: CycleModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const daysInMonth = new Date(Number(newCycleForm.year), Number(newCycleForm.month), 0).getDate();
    setNewCycleForm(prev => ({
      ...prev,
      startDate: `${prev.year}-${prev.month}-01`,
      endDate: `${prev.year}-${prev.month}-${daysInMonth}`
    }));
  }, [newCycleForm.year, newCycleForm.month, isOpen, setNewCycleForm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-md w-full rounded-2xl border-white/[0.08] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Tạo chu kỳ tính lương mới</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Năm</label>
              <select
                value={newCycleForm.year}
                onChange={e => setNewCycleForm(prev => ({ ...prev, year: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tháng</label>
              <select
                value={newCycleForm.month}
                onChange={e => setNewCycleForm(prev => ({ ...prev, month: e.target.value }))}
                className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ngày bắt đầu</label>
            <input
              type="date"
              required
              value={newCycleForm.startDate}
              onChange={e => setNewCycleForm(prev => ({ ...prev, startDate: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ngày kết thúc</label>
            <input
              type="date"
              required
              value={newCycleForm.endDate}
              onChange={e => setNewCycleForm(prev => ({ ...prev, endDate: e.target.value }))}
              className="block w-full rounded-lg bg-slate-900 border border-white/10 py-2.5 px-3 text-white text-sm focus:outline-none"
            />
          </div>

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
              Tạo chu kỳ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
