'use client';

import React from 'react';
import { PayrollCalculation } from './PayrollCalculations';
import { PayrollCycle } from './CycleSelector';

interface PaySlipModalProps {
  calculation: PayrollCalculation | null;
  onClose: () => void;
  currentCycle: PayrollCycle | undefined;
  formatMoney: (val: any) => string;
}

export default function PaySlipModal({
  calculation,
  onClose,
  currentCycle,
  formatMoney
}: PaySlipModalProps) {
  if (!calculation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full text-slate-800 shadow-2xl relative">
        
        {/* Header branding */}
        <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
          <h2 className="text-base font-extrabold text-slate-950 tracking-wider">CÔNG TY TNHH MTV CẨM THIÊN</h2>
          <p className="text-xs text-slate-500 mt-1">
            Phiếu lương chi tiết {currentCycle ? currentCycle.name.toLowerCase() : ''}
          </p>
        </div>

        {/* Employee info */}
        <div className="grid grid-cols-2 gap-y-2 text-xs mb-4">
          <div className="flex justify-between pr-4 border-r border-slate-200">
            <span className="text-slate-500">Mã số:</span>
            <span className="font-bold text-slate-900">{calculation.employee_id}</span>
          </div>
          <div className="flex justify-between pl-4">
            <span className="text-slate-500">Họ tên:</span>
            <span className="font-bold text-slate-900">{calculation.employee_name}</span>
          </div>
          <div className="flex justify-between pr-4 border-r border-slate-200">
            <span className="text-slate-500">Bộ phận:</span>
            <span className="font-semibold text-slate-900">{calculation.department}</span>
          </div>
          <div className="flex justify-between pl-4">
            <span className="text-slate-500">Chức vụ:</span>
            <span className="font-semibold text-slate-900">{calculation.position}</span>
          </div>
        </div>

        {/* Calculations List */}
        <div className="divide-y divide-slate-100 text-xs">
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600 font-semibold">Tổng lương hợp đồng (100%):</span>
            <span className="font-bold text-slate-955">{formatMoney(calculation.emp_total_salary)} đ</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-500">Mức lương đóng bảo hiểm:</span>
            <span className="font-semibold text-slate-900">{formatMoney(calculation.emp_insurance_salary)} đ</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600">Ngày công làm việc thực tế:</span>
            <div className="flex gap-6">
              <span className="text-slate-500">{calculation.total_workdays} ngày</span>
              <span className="font-bold text-slate-950">{formatMoney(calculation.salary_workdays)} đ</span>
            </div>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600">Lễ, Phép năm được hưởng lương:</span>
            <div className="flex gap-6">
              <span className="text-slate-500">{(parseFloat(calculation.leave_days || '0') + parseFloat(calculation.holiday_days || '0')).toFixed(1)} ngày</span>
              <span className="font-bold text-slate-955">{formatMoney(calculation.salary_leave_holiday)} đ</span>
            </div>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600 text-amber-700">Tăng ca ngày thường (150%):</span>
            <div className="flex gap-6">
              <span className="text-slate-500">{calculation.ot_hours_regular} giờ</span>
              <span className="font-bold text-slate-950">{formatMoney(calculation.ot_pay_regular)} đ</span>
            </div>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600 text-rose-700">Tăng ca ngày Chủ Nhật (200%):</span>
            <div className="flex gap-6">
              <span className="text-slate-500">{calculation.ot_hours_sunday} giờ</span>
              <span className="font-bold text-slate-950">{formatMoney(calculation.ot_pay_sunday)} đ</span>
            </div>
          </div>
          
          {/* Allowances list details */}
          {(parseFloat(calculation.allowance_seniority || '0') > 0 || parseFloat(calculation.allowance_female || '0') > 0 || parseFloat(calculation.allowance_children || '0') > 0) && (
            <div className="py-2.5 space-y-1.5 bg-slate-50 px-2 rounded-lg my-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phụ cấp được cộng:</span>
              {parseFloat(calculation.allowance_seniority || '0') > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>• Thâm niên:</span>
                  <span>{formatMoney(calculation.allowance_seniority)} đ</span>
                </div>
              )}
              {parseFloat(calculation.allowance_female || '0') > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>• Hỗ trợ hành kinh (Nữ):</span>
                  <span>{formatMoney(calculation.allowance_female)} đ</span>
                </div>
              )}
              {parseFloat(calculation.allowance_children || '0') > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>• Hỗ trợ con nhỏ (&lt; 6t):</span>
                  <span>{formatMoney(calculation.allowance_children)} đ</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between py-3 border-t-2 border-slate-200">
            <span className="text-slate-950 font-extrabold uppercase">TỔNG THU NHẬP (Gồm tăng ca):</span>
            <span className="font-extrabold text-slate-955 text-sm">{formatMoney(calculation.total_income)} đ</span>
          </div>
          
          {/* Deductions */}
          <div className="py-2 bg-rose-50/50 px-2 rounded-lg my-1">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Các khoản khấu trừ:</span>
            <div className="flex justify-between py-1 text-slate-600">
              <span>BHXH khấu trừ (10.5%):</span>
              <span className="font-semibold text-slate-800">-{formatMoney(calculation.deduction_social_insurance)} đ</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Đoàn phí công đoàn:</span>
              <span className="font-semibold text-slate-800">-{formatMoney(calculation.deduction_union)} đ</span>
            </div>
            {parseFloat(calculation.tax_amount || '0') > 0 && (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Thuế TNCN tạm tính:</span>
                <span className="font-semibold text-rose-600">-{formatMoney(calculation.tax_amount)} đ</span>
              </div>
            )}
          </div>

          {/* Net salary */}
          <div className="flex justify-between py-3 border-t-2 border-slate-950">
            <span className="text-slate-955 font-extrabold text-sm uppercase">LƯƠNG THỰC NHẬN:</span>
            <span className="font-extrabold text-indigo-700 text-base">{formatMoney(calculation.net_salary)} đ</span>
          </div>

          {/* Installments details */}
          <div className="flex justify-between py-2 border-t border-slate-100 text-[11px] text-slate-500 italic">
            <div className="flex flex-col">
              <span>• Chi đợt 1 (Hành chính): {formatMoney(calculation.advance_1)} đ</span>
              <span>• Chi đợt 2 (Tăng ca): {formatMoney(calculation.advance_2)} đ</span>
            </div>
          </div>
        </div>

        {/* Signature Area */}
        <div className="mt-8 text-center border-t border-slate-100 pt-4">
          <p className="text-[10px] text-slate-400 italic">Cảm ơn đóng góp của các anh chị đối với công ty!</p>
          <div className="mt-6 flex justify-between px-6">
            <div className="text-slate-500 text-xs">Người lập phiếu</div>
            <div className="text-slate-500 text-xs flex flex-col items-center">
              <span>Ký nhận</span>
              <span className="mt-8 font-bold text-slate-900">{calculation.employee_name}</span>
            </div>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="mt-8 flex justify-center gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
          >
            In phiếu lương
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
