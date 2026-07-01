'use client';

import React from 'react';

export interface PayrollRule {
  key: string;
  value: string;
  description: string;
}

interface PayrollRulesProps {
  rules: PayrollRule[];
  ruleEditKey: string;
  ruleEditValue: string;
  onEditRule: (rule: PayrollRule) => void;
  onChangeRuleValue: (val: string) => void;
  onSaveRule: () => void;
  onCancelEdit: () => void;
}

export default function PayrollRules({
  rules,
  ruleEditKey,
  ruleEditValue,
  onEditRule,
  onChangeRuleValue,
  onSaveRule,
  onCancelEdit
}: PayrollRulesProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-bold text-white">Cấu hình quy tắc tính lương chung</h3>
      <div className="glass-panel rounded-2xl border-white/[0.06] overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {rules.map(rule => (
            <div key={rule.key} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.005] transition-all">
              <div className="max-w-xl">
                <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                  {rule.key}
                </span>
                <h4 className="text-sm font-semibold text-white mt-2.5">{rule.description}</h4>
              </div>

              <div className="flex items-center gap-3">
                {ruleEditKey === rule.key ? (
                  <>
                    <input
                      type="text"
                      value={ruleEditValue}
                      onChange={e => onChangeRuleValue(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-lg py-1.5 px-3 text-white text-sm focus:outline-none focus:border-indigo-500 w-24 text-center font-bold"
                    />
                    <button
                      onClick={onSaveRule}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      Lưu
                    </button>
                    <button
                      onClick={onCancelEdit}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-white">{rule.value}</span>
                    <button
                      onClick={() => onEditRule(rule)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      Thay đổi
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
