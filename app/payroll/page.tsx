'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CycleSelector, { PayrollCycle } from './components/CycleSelector';
import CycleModal from './components/CycleModal';
import EmployeeList, { Employee } from './components/EmployeeList';
import EmployeeModal from './components/EmployeeModal';
import TimekeepingList, { TimekeepingRecord } from './components/TimekeepingList';
import PayrollCalculations, { PayrollCalculation } from './components/PayrollCalculations';
import PaySlipModal from './components/PaySlipModal';
import PayrollRules, { PayrollRule } from './components/PayrollRules';

interface UserSession {
  username: string;
  displayName: string;
  permissions: string[];
}

export default function PayrollPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'employees' | 'timekeeping' | 'calculations' | 'rules'>('calculations');
  
  // Cycle State
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({
    year: '2026',
    month: '04',
    startDate: '2026-04-01',
    endDate: '2026-04-30'
  });

  // Tab 1: Employee State with Paging & Sorting
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeLimit, setEmployeeLimit] = useState(10);
  const [employeeSortBy, setEmployeeSortBy] = useState('id');
  const [employeeSortOrder, setEmployeeSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDept, setEmployeeDept] = useState('');
  const [uniqueDepartments, setUniqueDepartments] = useState<string[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});

  // Tab 2: Timekeeping State with Paging & Sorting
  const [timekeepingRecords, setTimekeepingRecords] = useState<TimekeepingRecord[]>([]);
  const [timekeepingTotal, setTimekeepingTotal] = useState(0);
  const [timekeepingPage, setTimekeepingPage] = useState(1);
  const [timekeepingLimit, setTimekeepingLimit] = useState(25);
  const [timekeepingSortBy, setTimekeepingSortBy] = useState('date');
  const [timekeepingSortOrder, setTimekeepingSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [timekeepingSearch, setTimekeepingSearch] = useState('');

  // Tab 3: Calculations State with Paging & Sorting
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);
  const [calculationsTotal, setCalculationsTotal] = useState(0);
  const [calculationsPage, setCalculationsPage] = useState(1);
  const [calculationsLimit, setCalculationsLimit] = useState(10);
  const [calculationsSortBy, setCalculationsSortBy] = useState('employee_id');
  const [calculationsSortOrder, setCalculationsSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [calculationsSearch, setCalculationsSearch] = useState('');
  
  const [selectedSlipCalculation, setSelectedSlipCalculation] = useState<PayrollCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Tab 4: Rules State
  const [rules, setRules] = useState<PayrollRule[]>([]);
  const [ruleEditKey, setRuleEditKey] = useState('');
  const [ruleEditValue, setRuleEditValue] = useState('');

  // Notification Banners
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auth check
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const hasPermission = data.session.username === 'admin' || data.session.permissions.includes('payroll');
      if (!hasPermission) {
        router.replace('/modules');
        return;
      }
      setSession(data.session);
    } catch (e) {
      router.replace('/login');
    }
  };

  // 1. Fetch Cycles
  const fetchCycles = async () => {
    try {
      const res = await fetch('/api/payroll?type=cycles');
      const data = await res.json();
      if (res.ok && data.success) {
        setCycles(data.data);
        if (data.data.length > 0 && !selectedCycleId) {
          setSelectedCycleId(data.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Fetch Unique Departments
  const fetchUniqueDepartments = async () => {
    try {
      const res = await fetch('/api/employees?getDepartments=true');
      const data = await res.json();
      if (res.ok && data.success) {
        setUniqueDepartments(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Fetch Employees (Paged, Filtered, Sorted)
  const fetchEmployees = async () => {
    try {
      const queryParams = new URLSearchParams({
        search: employeeSearch,
        department: employeeDept,
        page: employeePage.toString(),
        limit: employeeLimit.toString(),
        sortBy: employeeSortBy,
        sortOrder: employeeSortOrder
      });
      const res = await fetch(`/api/employees?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployees(data.data);
        setEmployeeTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Fetch Timekeeping (Paged, Filtered, Sorted)
  const fetchTimekeeping = async () => {
    if (!selectedCycleId) return;
    try {
      const queryParams = new URLSearchParams({
        cycleId: selectedCycleId,
        search: timekeepingSearch,
        page: timekeepingPage.toString(),
        limit: timekeepingLimit.toString(),
        sortBy: timekeepingSortBy,
        sortOrder: timekeepingSortOrder
      });
      const res = await fetch(`/api/timekeeping?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTimekeepingRecords(data.data);
        setTimekeepingTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Fetch Calculations (Paged, Filtered, Sorted)
  const fetchCalculations = async () => {
    if (!selectedCycleId) return;
    try {
      const queryParams = new URLSearchParams({
        type: 'calculations',
        cycleId: selectedCycleId,
        search: calculationsSearch,
        page: calculationsPage.toString(),
        limit: calculationsLimit.toString(),
        sortBy: calculationsSortBy,
        sortOrder: calculationsSortOrder
      });
      const res = await fetch(`/api/payroll?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCalculations(data.data);
        setCalculationsTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Fetch Rules
  const fetchRules = async () => {
    try {
      const res = await fetch('/api/payroll/rules');
      const data = await res.json();
      if (res.ok && data.success) {
        setRules(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchSession().then(() => {
      fetchCycles().then(() => {
        fetchUniqueDepartments();
        fetchRules();
        setLoading(false);
      });
    });
  }, [router]);

  // Reactive Fetches
  useEffect(() => {
    fetchEmployees();
  }, [employeeSearch, employeeDept, employeePage, employeeLimit, employeeSortBy, employeeSortOrder]);

  useEffect(() => {
    fetchTimekeeping();
  }, [selectedCycleId, timekeepingSearch, timekeepingPage, timekeepingLimit, timekeepingSortBy, timekeepingSortOrder]);

  useEffect(() => {
    fetchCalculations();
  }, [selectedCycleId, calculationsSearch, calculationsPage, calculationsLimit, calculationsSortBy, calculationsSortOrder]);

  // Handlers for Employees
  const handleEmployeeChangeParams = (params: any) => {
    if (params.search !== undefined) setEmployeeSearch(params.search);
    if (params.department !== undefined) setEmployeeDept(params.department);
    if (params.page !== undefined) setEmployeePage(params.page);
    if (params.limit !== undefined) setEmployeeLimit(params.limit);
    if (params.sortBy !== undefined) setEmployeeSortBy(params.sortBy);
    if (params.sortOrder !== undefined) setEmployeeSortOrder(params.sortOrder);
  };

  const handleOpenEmployeeEdit = (emp: Employee) => {
    setEmployeeForm(emp);
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeForm)
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi lưu hồ sơ.');
      } else {
        showNotification('success', 'Đã lưu cấu hình nhân viên thành công.');
        setShowEmployeeModal(false);
        fetchEmployees();
        // Update calculations if they were already computed
        fetchCalculations();
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  // Handlers for Timekeeping
  const handleTimekeepingChangeParams = (params: any) => {
    if (params.search !== undefined) setTimekeepingSearch(params.search);
    if (params.page !== undefined) setTimekeepingPage(params.page);
    if (params.limit !== undefined) setTimekeepingLimit(params.limit);
    if (params.sortBy !== undefined) setTimekeepingSortBy(params.sortBy);
    if (params.sortOrder !== undefined) setTimekeepingSortOrder(params.sortOrder);
  };

  const handleImportSuccess = (msg: string) => {
    showNotification('success', msg);
    fetchTimekeeping();
    fetchEmployees();
  };

  const handleImportError = (msg: string) => {
    showNotification('error', msg);
  };

  // Handlers for Calculations
  const handleCalculationsChangeParams = (params: any) => {
    if (params.search !== undefined) setCalculationsSearch(params.search);
    if (params.page !== undefined) setCalculationsPage(params.page);
    if (params.limit !== undefined) setCalculationsLimit(params.limit);
    if (params.sortBy !== undefined) setCalculationsSortBy(params.sortBy);
    if (params.sortOrder !== undefined) setCalculationsSortOrder(params.sortOrder);
  };

  const handleCalculatePayroll = async () => {
    if (!selectedCycleId) return;
    setIsCalculating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          cycleId: selectedCycleId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi tính lương.');
      } else {
        showNotification('success', 'Tính lương hoàn tất!');
        fetchCalculations();
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleFinalizeCycle = async () => {
    if (!selectedCycleId) return;
    if (!confirm('Sau khi chốt bảng lương, dữ liệu chấm công và bảng lương của tháng này sẽ được lưu cố định và không thể tính toán lại. Xác nhận chốt?')) return;

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          cycleId: selectedCycleId
        })
      });

      if (res.ok) {
        showNotification('success', 'Đã chốt bảng lương thành công.');
        fetchCycles();
      } else {
        showNotification('error', 'Lỗi chốt bảng lương.');
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  const handleSelectSlip = async (calc: PayrollCalculation) => {
    try {
      const res = await fetch(`/api/payroll?type=details&cycleId=${selectedCycleId}&employeeId=${calc.employee_id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedSlipCalculation(data.data);
      } else {
        setSelectedSlipCalculation(calc);
      }
    } catch (e) {
      setSelectedSlipCalculation(calc);
    }
  };

  // Handlers for Cycle creation/deletion
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `${newCycleForm.year}-${newCycleForm.month}`;
    const name = `Tháng ${newCycleForm.month}/${newCycleForm.year}`;

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_cycle',
          cycleId: id,
          name,
          startDate: newCycleForm.startDate,
          endDate: newCycleForm.endDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Lỗi khi tạo chu kỳ mới.');
      } else {
        showNotification('success', `Đã tạo thành công chu kỳ tính lương ${name}`);
        setShowCreateCycleModal(false);
        fetchCycles().then(() => {
          setSelectedCycleId(id);
        });
      }
    } catch (err) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  const handleDeleteCycle = async () => {
    if (!selectedCycleId) return;
    const cycle = cycles.find(c => c.id === selectedCycleId);
    if (!cycle) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa chu kỳ ${cycle.name} và toàn bộ dữ liệu chấm công/bảng lương đi kèm không?`)) return;

    try {
      const res = await fetch(`/api/payroll?cycleId=${selectedCycleId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('success', `Đã xóa chu kỳ ${cycle.name} thành công.`);
        setSelectedCycleId('');
        fetchCycles();
      } else {
        showNotification('error', 'Lỗi khi xóa chu kỳ.');
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  // Handlers for general rules
  const handleSaveRule = async () => {
    if (!ruleEditKey) return;
    try {
      const res = await fetch('/api/payroll/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: ruleEditKey,
          value: ruleEditValue
        })
      });

      if (res.ok) {
        showNotification('success', 'Đã lưu cấu hình chung thành công.');
        setRuleEditKey('');
        fetchRules();
      } else {
        showNotification('error', 'Lỗi khi cập nhật cấu hình.');
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối.');
    }
  };

  // Helper Formatter
  const formatMoney = (val: any) => {
    if (val === undefined || val === null || val === '-') return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '-';
    if (num === 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const currentCycle = cycles.find(c => c.id === selectedCycleId);
  const isFinalized = currentCycle?.status === 'finalized';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navbar */}
      <header className="glass-panel border-t-0 border-x-0 border-b border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/modules')}
              className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <span className="font-bold text-white hidden sm:inline">Chấm Công & Tính Lương</span>
            
            <CycleSelector
              cycles={cycles}
              selectedCycleId={selectedCycleId}
              onSelectCycle={setSelectedCycleId}
              onOpenCreateModal={() => setShowCreateCycleModal(true)}
              onDeleteCycle={handleDeleteCycle}
              session={session}
            />
          </div>

          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden md:inline-flex text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                {session.displayName}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Floating Notifications */}
        {notification && (
          <div className={`fixed bottom-4 right-4 z-50 rounded-xl p-4 border animate-fade-in text-sm max-w-sm shadow-lg ${
            notification.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Current Cycle Period Details */}
        {currentCycle && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl glass-panel-light border-white/[0.04] animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-slate-400">
              <div>
                Chu kỳ: <strong className="text-white">{currentCycle.name}</strong>
              </div>
              <div className="hidden sm:block h-3 w-px bg-white/10" />
              <div>
                Thời gian: <strong className="text-slate-200">{new Date(currentCycle.start_date).toLocaleDateString('vi-VN')}</strong> đến <strong className="text-slate-200">{new Date(currentCycle.end_date).toLocaleDateString('vi-VN')}</strong>
              </div>
              <div className="hidden sm:block h-3 w-px bg-white/10" />
              <div>
                Trạng thái: {' '}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isFinalized 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {isFinalized ? '🔒 Bảng lương đã chốt' : '✍️ Đang soạn thảo'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-white/[0.06] mb-8">
          <nav className="flex space-x-6">
            {[
              { id: 'calculations', label: 'Bảng tính lương' },
              { id: 'timekeeping', label: 'Dữ liệu chấm công' },
              { id: 'employees', label: 'Cấu hình lương nhân viên' },
              { id: 'rules', label: 'Quy tắc lương chung' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Render Tab Views */}
        <div className="animate-fade-in">
          {activeTab === 'employees' && (
            <EmployeeList
              employees={employees}
              total={employeeTotal}
              page={employeePage}
              limit={employeeLimit}
              sortBy={employeeSortBy}
              sortOrder={employeeSortOrder}
              search={employeeSearch}
              department={employeeDept}
              departments={uniqueDepartments}
              onChangeParams={handleEmployeeChangeParams}
              onEdit={handleOpenEmployeeEdit}
              formatMoney={formatMoney}
            />
          )}

          {activeTab === 'timekeeping' && (
            <TimekeepingList
              records={timekeepingRecords}
              total={timekeepingTotal}
              page={timekeepingPage}
              limit={timekeepingLimit}
              sortBy={timekeepingSortBy}
              sortOrder={timekeepingSortOrder}
              search={timekeepingSearch}
              onChangeParams={handleTimekeepingChangeParams}
              isFinalized={isFinalized}
              selectedCycleId={selectedCycleId}
              onImportSuccess={handleImportSuccess}
              onImportError={handleImportError}
            />
          )}

          {activeTab === 'calculations' && (
            <PayrollCalculations
              calculations={calculations}
              total={calculationsTotal}
              page={calculationsPage}
              limit={calculationsLimit}
              sortBy={calculationsSortBy}
              sortOrder={calculationsSortOrder}
              search={calculationsSearch}
              onChangeParams={handleCalculationsChangeParams}
              isCalculating={isCalculating}
              isFinalized={isFinalized}
              onCalculate={handleCalculatePayroll}
              onFinalize={handleFinalizeCycle}
              onSelectSlip={handleSelectSlip}
              formatMoney={formatMoney}
            />
          )}

          {activeTab === 'rules' && (
            <PayrollRules
              rules={rules}
              ruleEditKey={ruleEditKey}
              ruleEditValue={ruleEditValue}
              onEditRule={rule => {
                setRuleEditKey(rule.key);
                setRuleEditValue(rule.value);
              }}
              onChangeRuleValue={setRuleEditValue}
              onSaveRule={handleSaveRule}
              onCancelEdit={() => setRuleEditKey('')}
            />
          )}
        </div>
      </main>

      {/* Forms & Dialog Modals */}
      <CycleModal
        isOpen={showCreateCycleModal}
        onClose={() => setShowCreateCycleModal(false)}
        newCycleForm={newCycleForm}
        setNewCycleForm={setNewCycleForm}
        onSubmit={handleCreateCycle}
      />

      <EmployeeModal
        isOpen={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        employeeForm={employeeForm}
        setEmployeeForm={setEmployeeForm}
        onSubmit={handleSaveEmployee}
      />

      <PaySlipModal
        calculation={selectedSlipCalculation}
        onClose={() => setSelectedSlipCalculation(null)}
        currentCycle={currentCycle}
        formatMoney={formatMoney}
      />
    </div>
  );
}
