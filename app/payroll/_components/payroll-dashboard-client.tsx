"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Users, Shield, LayoutGrid, LogOut, Plus, Search, Edit2, 
  Trash2, Key, Bell, User, Check, X, ShieldAlert, ChevronRight,
  Home, Settings, HelpCircle, Loader2, Calendar, FileSpreadsheet,
  UploadCloud, FileText, CheckCircle2, Lock, Unlock, DollarSign,
  Info, Filter, Printer, Download, ArrowLeft, ChevronsLeft, 
  ChevronsRight, ChevronLeft, SlidersHorizontal, RefreshCw
} from "lucide-react";
import { formatVND, formatDate, formatDecimal } from "@/lib/format";

interface PayrollDashboardClientProps {
  currentUser: any;
  initialCycles: any[];
  initialEmployees: any[];
  initialRules: any[];
}

interface SalaryConfigItem {
  id: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  totalSalary: number | string;
  insuranceSalary: number | string;
  baseSalary: number | string;
  positionAllowance?: number | string | null;
  responsibilityAllowance?: number | string | null;
  seniorityAllowance?: number | string | null;
  safetyAllowance?: number | string | null;
  phoneAllowance?: number | string | null;
  travelAllowance?: number | string | null;
  housingAllowance?: number | string | null;
  attendanceBonus?: number | string | null;
  otherBonus?: number | string | null;
  mealAllowance?: number | string | null;
  note?: string | null;
}

interface SalaryConfigEmployeeTarget {
  id: string;
  employeeCode?: string;
  fullName?: string;
}

const payrollRuleGroups = [
  {
    id: "attendance",
    title: "Ngày công & quy đổi",
    description: "Thiết lập nền tảng để quy đổi ngày công, giờ công và đơn giá lương.",
    matches: (code: string) => code.includes("standard_hours") || code.includes("workday"),
  },
  {
    id: "overtime",
    title: "Hệ số tăng ca",
    description: "Các hệ số dùng khi tính tiền tăng ca ngày thường, Chủ Nhật và ngày lễ.",
    matches: (code: string) => code.includes("overtime"),
  },
  {
    id: "employee_deductions",
    title: "Khấu trừ nhân viên",
    description: "Tỷ lệ trừ vào lương người lao động như bảo hiểm và đoàn phí.",
    matches: (code: string) => code.startsWith("employee_"),
  },
  {
    id: "company_contributions",
    title: "Khoản công ty đóng",
    description: "Tỷ lệ chi phí doanh nghiệp đóng thêm ngoài phần lương thực nhận.",
    matches: (code: string) => code.startsWith("company_"),
  },
  {
    id: "other",
    title: "Quy tắc khác",
    description: "Các cấu hình bổ sung chưa thuộc nhóm cố định.",
    matches: () => true,
  },
];

const getRuleUnitLabel = (unit: string) => {
  switch (unit) {
    case "percent":
      return "Tỷ lệ";
    case "multiplier":
      return "Hệ số";
    case "hours":
      return "Giờ";
    default:
      return unit;
  }
};

export default function PayrollDashboardClient({
  currentUser,
  initialCycles,
  initialEmployees,
  initialRules,
}: PayrollDashboardClientProps) {
  const router = useRouter();
  const isAuditOnlyUser = currentUser.username === "admin2";
  const [activeTab, setActiveTab] = useState<"employees" | "rules" | "cycles" | "attendance" | "sheet" | "auditConfig" | "auditAttendance" | "auditSheet">(
    "employees"
  );
  const [cycles, setCycles] = useState(initialCycles);
  const [employees, setEmployees] = useState(initialEmployees);
  const [rules, setRules] = useState(initialRules);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(initialCycles[0]?.id || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Clean Attendance Records & Payroll Sheet State
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [payrollSheetItems, setPayrollSheetItems] = useState<any[]>([]);
  const [auditConfig, setAuditConfig] = useState<any>(null);
  const [auditAttendanceRecords, setAuditAttendanceRecords] = useState<any[]>([]);
  const [auditPayrollSheetItems, setAuditPayrollSheetItems] = useState<any[]>([]);
  const [activePayslip, setActivePayslip] = useState<any>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  // Pagination & Custom Filters State
  const [pageEmployees, setPageEmployees] = useState(1);
  const [limitEmployees, setLimitEmployees] = useState(20);
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  const [pageCycles, setPageCycles] = useState(1);
  const [limitCycles, setLimitCycles] = useState(20);
  const [cycleStatusFilter, setCycleStatusFilter] = useState("all");

  const [pageAttendance, setPageAttendance] = useState(1);
  const [limitAttendance, setLimitAttendance] = useState(20);

  const [pageSheet, setPageSheet] = useState(1);
  const [limitSheet, setLimitSheet] = useState(20);

  const [pageAuditAttendance, setPageAuditAttendance] = useState(1);
  const [limitAuditAttendance, setLimitAuditAttendance] = useState(20);

  const [pageAuditSheet, setPageAuditSheet] = useState(1);
  const [limitAuditSheet, setLimitAuditSheet] = useState(20);

  // Reset pagination & search when tab switches
  useEffect(() => {
    setSearchTerm("");
    setPageEmployees(1);
    setPageCycles(1);
    setPageAttendance(1);
    setPageSheet(1);
    setPageAuditAttendance(1);
    setPageAuditSheet(1);
  }, [activeTab]);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const employeeSelectAllRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0); // 0 = idle, 1 = uploading, 2 = parsing, 3 = cleaning, 4 = syncing, 5 = success

  // Modals Open State
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const [salaryConfigModalOpen, setSalaryConfigModalOpen] = useState(false);
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfigItem[]>([]);
  const [bulkSalaryModalOpen, setBulkSalaryModalOpen] = useState(false);
  
  const [cycleModalOpen, setCycleModalOpen] = useState(false);

  // Employee Form State
  const [empCodeForm, setEmpCodeForm] = useState("");
  const [empNameForm, setEmpNameForm] = useState("");
  const [empGenderForm, setEmpGenderForm] = useState("Nam");
  const [empDeptForm, setEmpDeptForm] = useState("");
  const [empPosForm, setEmpPosForm] = useState("");
  const [empJoinForm, setEmpJoinForm] = useState("");
  const [empStatusForm, setEmpStatusForm] = useState<"active" | "inactive" | "terminated">("active");
  const [empDependentsForm, setEmpDependentsForm] = useState(0);
  const [empChild6Form, setEmpChild6Form] = useState(false);
  const [empFormError, setEmpFormError] = useState<string | null>(null);

  // Salary Config Form State
  const [salaryConfigFormMode, setSalaryConfigFormMode] = useState<"edit" | "create">("create");
  const [editingSalaryConfigId, setEditingSalaryConfigId] = useState<string | null>(null);
  const [effectiveFromForm, setEffectiveFromForm] = useState("");
  const [insuranceSalaryForm, setInsuranceSalaryForm] = useState(0);
  const [baseSalaryForm, setBaseSalaryForm] = useState(0);
  const [posAllowanceForm, setPosAllowanceForm] = useState(0);
  const [respAllowanceForm, setRespAllowanceForm] = useState(0);
  const [seniorityAllowanceForm, setSeniorityAllowanceForm] = useState(0);
  const [safetyAllowanceForm, setSafetyAllowanceForm] = useState(0);
  const [phoneAllowanceForm, setPhoneAllowanceForm] = useState(0);
  const [travelAllowanceForm, setTravelAllowanceForm] = useState(0);
  const [housingAllowanceForm, setHousingAllowanceForm] = useState(0);
  const [attendanceBonusForm, setAttendanceBonusForm] = useState(0);
  const [otherBonusForm, setOtherBonusForm] = useState(0);
  const [mealAllowanceForm, setMealAllowanceForm] = useState(0);
  const [salaryNoteForm, setSalaryNoteForm] = useState("");
  const [salaryConfigError, setSalaryConfigError] = useState<string | null>(null);
  const [bulkSalaryEffectiveFromForm, setBulkSalaryEffectiveFromForm] = useState("");
  const [bulkSalaryInsuranceForm, setBulkSalaryInsuranceForm] = useState(0);
  const [bulkSalaryBaseForm, setBulkSalaryBaseForm] = useState(0);
  const [bulkSalaryPositionAllowanceForm, setBulkSalaryPositionAllowanceForm] = useState(0);
  const [bulkSalaryResponsibilityAllowanceForm, setBulkSalaryResponsibilityAllowanceForm] = useState(0);
  const [bulkSalarySeniorityAllowanceForm, setBulkSalarySeniorityAllowanceForm] = useState(0);
  const [bulkSalarySafetyAllowanceForm, setBulkSalarySafetyAllowanceForm] = useState(0);
  const [bulkSalaryPhoneAllowanceForm, setBulkSalaryPhoneAllowanceForm] = useState(0);
  const [bulkSalaryTravelAllowanceForm, setBulkSalaryTravelAllowanceForm] = useState(0);
  const [bulkSalaryHousingAllowanceForm, setBulkSalaryHousingAllowanceForm] = useState(0);
  const [bulkSalaryAttendanceBonusForm, setBulkSalaryAttendanceBonusForm] = useState(0);
  const [bulkSalaryOtherBonusForm, setBulkSalaryOtherBonusForm] = useState(0);
  const [bulkSalaryMealAllowanceForm, setBulkSalaryMealAllowanceForm] = useState(0);
  const [bulkSalaryNoteForm, setBulkSalaryNoteForm] = useState("");
  const [bulkSalaryError, setBulkSalaryError] = useState<string | null>(null);

  // Cycle Form State
  const [cycleCodeForm, setCycleCodeForm] = useState("");
  const [cycleNameForm, setCycleNameForm] = useState("");
  const [cycleStartForm, setCycleStartForm] = useState("");
  const [cycleEndForm, setCycleEndForm] = useState("");
  const [cycleStdWorkdaysForm, setCycleStdWorkdaysForm] = useState(26);
  const [cycleNoteForm, setCycleNoteForm] = useState("");
  const [cycleFormError, setCycleFormError] = useState<string | null>(null);

  const [auditDayLimitForm, setAuditDayLimitForm] = useState(4);
  const [auditMonthLimitForm, setAuditMonthLimitForm] = useState(40);
  const [auditYearLimitForm, setAuditYearLimitForm] = useState(300);
  const [auditAllowSundayForm, setAuditAllowSundayForm] = useState(false);
  const [auditEnableTier2Form, setAuditEnableTier2Form] = useState(false);
  const [auditNoteForm, setAuditNoteForm] = useState("");
  const [auditConfigStatus, setAuditConfigStatus] = useState<string | null>(null);

  // Selected Cycle helper object
  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const canOverrideFinalizedCycle = Boolean(currentUser.isAdmin);
  const isSelectedCycleFinalized = selectedCycle?.status === "locked" || selectedCycle?.status === "paid";
  const isSelectedCycleReadOnly = isSelectedCycleFinalized && !canOverrideFinalizedCycle;

  // Load data for active cycle
  useEffect(() => {
    if (selectedCycleId) {
      loadAttendanceRecords();
      loadPayrollSheet();
      loadAuditAttendanceRecords();
      loadAuditPayrollSheet();
    }
  }, [selectedCycleId]);

  useEffect(() => {
    loadAuditConfig();
  }, []);

  const loadAttendanceRecords = async () => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch(`/api/timekeeping/records?cycleId=${selectedCycleId}`);
      const data = await res.json();
      if (data.success) {
        setAttendanceRecords(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPayrollSheet = async () => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch(`/api/payroll/items?cycleId=${selectedCycleId}`);
      const data = await res.json();
      if (data.success) {
        setPayrollSheetItems(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditConfig = async () => {
    try {
      const res = await fetch("/api/audit/config");
      const data = await res.json();
      if (data.success) {
        setAuditConfig(data.data);
        setAuditDayLimitForm(Number(data.data.maxOvertimeHoursPerDay || 4));
        setAuditMonthLimitForm(Number(data.data.maxOvertimeHoursPerMonth || 40));
        setAuditYearLimitForm(Number(data.data.maxOvertimeHoursPerYear || 300));
        setAuditAllowSundayForm(Boolean(data.data.allowSundayWork));
        setAuditEnableTier2Form(Boolean(data.data.enableOvertimeTier2));
        setAuditNoteForm(data.data.note || "");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditAttendanceRecords = async () => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch(`/api/audit/attendance?cycleId=${selectedCycleId}`);
      const data = await res.json();
      if (data.success) {
        setAuditAttendanceRecords(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditPayrollSheet = async () => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch(`/api/audit/payroll-items?cycleId=${selectedCycleId}`);
      const data = await res.json();
      if (data.success) {
        setAuditPayrollSheetItems(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      const cyRes = await fetch("/api/payroll/cycles");
      const cyData = await cyRes.json();
      if (cyData.success) setCycles(cyData.data);

      const emRes = await fetch("/api/employees");
      const emData = await emRes.json();
      if (emData.success) setEmployees(emData.data);

      const ruRes = await fetch("/api/payroll/rules");
      const ruData = await ruRes.json();
      if (ruData.success) setRules(ruData.data);

      await loadAuditConfig();

      if (selectedCycleId) {
        await loadAttendanceRecords();
        await loadPayrollSheet();
        await loadAuditAttendanceRecords();
        await loadAuditPayrollSheet();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Employees CRUD
  const openEmployeeModal = (empItem: any = null) => {
    setSelectedEmployee(empItem);
    setEmpFormError(null);
    if (empItem) {
      setEmpCodeForm(empItem.employeeCode);
      setEmpNameForm(empItem.fullName);
      setEmpGenderForm(empItem.gender || "Nam");
      setEmpDeptForm(empItem.departmentName || "");
      setEmpPosForm(empItem.positionTitle || "");
      setEmpJoinForm(empItem.joinedDate ? new Date(empItem.joinedDate).toISOString().split("T")[0] : "");
      setEmpStatusForm(empItem.status);
      setEmpDependentsForm(empItem.dependentCount);
      setEmpChild6Form(empItem.hasChildUnder6);
    } else {
      setEmpCodeForm("");
      setEmpNameForm("");
      setEmpGenderForm("Nam");
      setEmpDeptForm("");
      setEmpPosForm("");
      setEmpJoinForm(new Date().toISOString().split("T")[0]);
      setEmpStatusForm("active");
      setEmpDependentsForm(0);
      setEmpChild6Form(false);
    }
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpFormError(null);

    const payload = {
      employeeCode: empCodeForm,
      fullName: empNameForm,
      gender: empGenderForm,
      departmentName: empDeptForm,
      positionTitle: empPosForm,
      joinedDate: empJoinForm || null,
      status: empStatusForm,
      dependentCount: empDependentsForm,
      hasChildUnder6: empChild6Form,
    };

    try {
      setIsLoading(true);
      const url = selectedEmployee ? `/api/employees/${selectedEmployee.id}` : "/api/employees";
      const method = selectedEmployee ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setEmpFormError(data.error?.message || "Lỗi khi lưu.");
        return;
      }
      setEmployeeModalOpen(false);
      await refreshAllData();
    } catch (err) {
      setEmpFormError("Lỗi kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeDelete = async (id: string) => {
    if (!confirm("Bạn có muốn ngừng hoạt động/xóa nhân viên này?")) return;
    try {
      setIsLoading(true);
      await fetch(`/api/employees/${id}`, { method: "DELETE" });
      await refreshAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Salary Configuration history & creation
  const todayInputValue = () => new Date().toISOString().split("T")[0];
  const toDateInputValue = (value: string | Date | null | undefined) => {
    if (!value) return todayInputValue();
    if (typeof value === "string") return value.slice(0, 10);
    return new Date(value).toISOString().split("T")[0];
  };
  const toSalaryNumber = (value: number | string | null | undefined) => Number(value || 0);
  const getCurrentSalaryConfig = (configs: SalaryConfigItem[]) => configs.find((config) => !config.effectiveTo) || null;
  const fillSalaryConfigForm = (config: SalaryConfigItem, options: { effectiveFrom?: string; note?: string } = {}) => {
    setEffectiveFromForm(options.effectiveFrom || toDateInputValue(config.effectiveFrom));
    setInsuranceSalaryForm(toSalaryNumber(config.insuranceSalary));
    setBaseSalaryForm(toSalaryNumber(config.baseSalary));
    setPosAllowanceForm(toSalaryNumber(config.positionAllowance));
    setRespAllowanceForm(toSalaryNumber(config.responsibilityAllowance));
    setSeniorityAllowanceForm(toSalaryNumber(config.seniorityAllowance));
    setSafetyAllowanceForm(toSalaryNumber(config.safetyAllowance));
    setPhoneAllowanceForm(toSalaryNumber(config.phoneAllowance));
    setTravelAllowanceForm(toSalaryNumber(config.travelAllowance));
    setHousingAllowanceForm(toSalaryNumber(config.housingAllowance));
    setAttendanceBonusForm(toSalaryNumber(config.attendanceBonus));
    setOtherBonusForm(toSalaryNumber(config.otherBonus));
    setMealAllowanceForm(toSalaryNumber(config.mealAllowance));
    setSalaryNoteForm(options.note ?? (config.note || ""));
  };
  const resetSalaryConfigForm = () => {
    setEffectiveFromForm(todayInputValue());
    setInsuranceSalaryForm(0);
    setBaseSalaryForm(0);
    setPosAllowanceForm(0);
    setRespAllowanceForm(0);
    setSeniorityAllowanceForm(0);
    setSafetyAllowanceForm(0);
    setPhoneAllowanceForm(0);
    setTravelAllowanceForm(0);
    setHousingAllowanceForm(0);
    setAttendanceBonusForm(0);
    setOtherBonusForm(0);
    setMealAllowanceForm(0);
    setSalaryNoteForm("");
  };

  const openSalaryConfigModal = async (emp: SalaryConfigEmployeeTarget) => {
    setSelectedEmployee(emp);
    setSalaryConfigError(null);
    setSalaryConfigFormMode("create");
    setEditingSalaryConfigId(null);
    resetSalaryConfigForm();

    try {
      setIsLoading(true);
      const res = await fetch(`/api/employees/${emp.id}/salary-configs`);
      const data = await res.json();
      if (data.success) {
        const configs = data.data as SalaryConfigItem[];
        setSalaryConfigs(configs);

        const current = getCurrentSalaryConfig(configs);
        if (current) {
          fillSalaryConfigForm(current);
          setEditingSalaryConfigId(current.id);
          setSalaryConfigFormMode("edit");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
    setSalaryConfigModalOpen(true);
  };

  const startNewSalaryConfig = () => {
    setSalaryConfigError(null);
    setSalaryConfigFormMode("create");
    setEditingSalaryConfigId(null);
    setEffectiveFromForm(todayInputValue());
    setSalaryNoteForm("");
  };

  const restoreSalaryConfig = (config: SalaryConfigItem) => {
    setSalaryConfigError(null);
    setSalaryConfigFormMode("create");
    setEditingSalaryConfigId(null);
    fillSalaryConfigForm(config, {
      effectiveFrom: todayInputValue(),
      note: config.note || `Khôi phục từ cấu hình ngày ${formatDate(config.effectiveFrom)}`,
    });
  };

  const editSalaryConfig = (config: SalaryConfigItem) => {
    setSalaryConfigError(null);
    setSalaryConfigFormMode("edit");
    setEditingSalaryConfigId(config.id);
    fillSalaryConfigForm(config);
  };

  const handleSalaryConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalaryConfigError(null);

    const payload = {
      effectiveFrom: effectiveFromForm,
      insuranceSalary: insuranceSalaryForm,
      baseSalary: baseSalaryForm,
      positionAllowance: posAllowanceForm,
      responsibilityAllowance: respAllowanceForm,
      seniorityAllowance: seniorityAllowanceForm,
      safetyAllowance: safetyAllowanceForm,
      phoneAllowance: phoneAllowanceForm,
      travelAllowance: travelAllowanceForm,
      housingAllowance: housingAllowanceForm,
      attendanceBonus: attendanceBonusForm,
      otherBonus: otherBonusForm,
      mealAllowance: mealAllowanceForm,
      note: salaryNoteForm,
    };

    try {
      setIsLoading(true);
      const isEditing = salaryConfigFormMode === "edit";
      if (isEditing && !editingSalaryConfigId) {
        setSalaryConfigError("Không tìm thấy bản ghi cấu hình lương hiện tại để sửa.");
        return;
      }

      const res = await fetch(`/api/employees/${selectedEmployee.id}/salary-configs`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { ...payload, id: editingSalaryConfigId } : payload),
      });
      const data = await res.json();
      if (!data.success) {
        setSalaryConfigError(data.error?.message || "Lỗi lưu cấu hình lương.");
        return;
      }
      
      // Reload configs list
      const reloadRes = await fetch(`/api/employees/${selectedEmployee.id}/salary-configs`);
      const reloadData = await reloadRes.json();
      if (reloadData.success) {
        const configs = reloadData.data as SalaryConfigItem[];
        setSalaryConfigs(configs);
        const savedConfig = configs.find((config) => config.id === data.data?.id) || getCurrentSalaryConfig(configs);
        if (savedConfig) {
          fillSalaryConfigForm(savedConfig);
          setEditingSalaryConfigId(savedConfig.id);
          setSalaryConfigFormMode("edit");
        }
      }
      
      alert(isEditing ? "Đã lưu cấu hình lương hiện tại." : "Đã thêm và sử dụng cấu hình lương mới.");
    } catch (err) {
      setSalaryConfigError("Lỗi kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeSelectionChange = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(employeeId);
      } else {
        next.delete(employeeId);
      }
      return next;
    });
  };

  const openBulkSalaryModal = () => {
    if (selectedEmployeeIds.size === 0) return;
    setBulkSalaryEffectiveFromForm(new Date().toISOString().split("T")[0]);
    setBulkSalaryInsuranceForm(0);
    setBulkSalaryBaseForm(0);
    setBulkSalaryPositionAllowanceForm(0);
    setBulkSalaryResponsibilityAllowanceForm(0);
    setBulkSalarySeniorityAllowanceForm(0);
    setBulkSalarySafetyAllowanceForm(0);
    setBulkSalaryPhoneAllowanceForm(0);
    setBulkSalaryTravelAllowanceForm(0);
    setBulkSalaryHousingAllowanceForm(0);
    setBulkSalaryAttendanceBonusForm(0);
    setBulkSalaryOtherBonusForm(0);
    setBulkSalaryMealAllowanceForm(0);
    setBulkSalaryNoteForm("");
    setBulkSalaryError(null);
    setBulkSalaryModalOpen(true);
  };

  const handleBulkSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSalaryError(null);

    const employeeIds = Array.from(selectedEmployeeIds);
    if (employeeIds.length === 0) {
      setBulkSalaryError("Vui lòng chọn ít nhất một nhân viên.");
      return;
    }

    if (!bulkSalaryEffectiveFromForm) {
      setBulkSalaryError("Vui lòng chọn ngày hiệu lực.");
      return;
    }

    const bulkSalaryValues = [
      bulkSalaryInsuranceForm,
      bulkSalaryBaseForm,
      bulkSalaryPositionAllowanceForm,
      bulkSalaryResponsibilityAllowanceForm,
      bulkSalarySeniorityAllowanceForm,
      bulkSalarySafetyAllowanceForm,
      bulkSalaryPhoneAllowanceForm,
      bulkSalaryTravelAllowanceForm,
      bulkSalaryHousingAllowanceForm,
      bulkSalaryAttendanceBonusForm,
      bulkSalaryOtherBonusForm,
      bulkSalaryMealAllowanceForm,
    ];

    if (bulkSalaryValues.some((value) => value < 0)) {
      setBulkSalaryError("Các khoản lương và phụ cấp phải là số không âm.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/employees/salary-configs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds,
          effectiveFrom: bulkSalaryEffectiveFromForm,
          insuranceSalary: bulkSalaryInsuranceForm,
          baseSalary: bulkSalaryBaseForm,
          positionAllowance: bulkSalaryPositionAllowanceForm,
          responsibilityAllowance: bulkSalaryResponsibilityAllowanceForm,
          seniorityAllowance: bulkSalarySeniorityAllowanceForm,
          safetyAllowance: bulkSalarySafetyAllowanceForm,
          phoneAllowance: bulkSalaryPhoneAllowanceForm,
          travelAllowance: bulkSalaryTravelAllowanceForm,
          housingAllowance: bulkSalaryHousingAllowanceForm,
          attendanceBonus: bulkSalaryAttendanceBonusForm,
          otherBonus: bulkSalaryOtherBonusForm,
          mealAllowance: bulkSalaryMealAllowanceForm,
          note: bulkSalaryNoteForm,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setBulkSalaryError(data.error?.message || "Không thể gán lương đồng loạt.");
        return;
      }

      setBulkSalaryModalOpen(false);
      setSelectedEmployeeIds(new Set());
      await refreshAllData();
      alert(`Đã gán lương cho ${data.data.updatedCount} nhân viên.`);
    } catch (err) {
      setBulkSalaryError("Lỗi kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  // Rule updating
  const handleRuleUpdate = async (id: string, code: string, val: number) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi cập nhật quy tắc");
        return;
      }
      await refreshAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cycles CRUD & Process
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setCycleFormError(null);

    const payload = {
      code: cycleCodeForm, // YYYY-MM
      name: cycleNameForm,
      periodStart: cycleStartForm,
      periodEnd: cycleEndForm,
      standardWorkdays: cycleStdWorkdaysForm,
    };

    try {
      setIsLoading(true);
      const res = await fetch("/api/payroll/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setCycleFormError(data.error?.message || "Lỗi tạo chu kỳ.");
        return;
      }
      setCycleModalOpen(false);
      await refreshAllData();
      if (data.data.id) setSelectedCycleId(data.data.id);
    } catch (err) {
      setCycleFormError("Lỗi kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculatePayroll = async (cycleId: string) => {
    if (!confirm("Hệ thống sẽ tính toán lương cho toàn bộ nhân sự dựa trên chấm công đã làm sạch và cấu hình lương. Tiến hành?")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/cycles/${cycleId}/calculate`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi tính lương");
        return;
      }
      alert("Tính lương hoàn tất!");
      await refreshAllData();
      setActiveTab("sheet");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteImportedAttendance = async () => {
    if (!selectedCycleId) return;
    if (isSelectedCycleReadOnly) {
      alert("Chu kỳ lương này đã khóa hoặc chi trả, không thể xóa dữ liệu chấm công.");
      return;
    }

    if (!confirm("Xóa dữ liệu chấm công đã import của chu kỳ này? Bảng lương và dữ liệu audit đã tính từ chấm công này cũng sẽ được xóa. Admin có thể thực hiện cả với chu kỳ đã khóa/đã chi trả.")) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/timekeeping/imports?cycleId=${encodeURIComponent(selectedCycleId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Không thể xóa dữ liệu chấm công.");
        return;
      }

      alert(`Đã xóa ${data.data.deletedAttendanceRecords || 0} dòng chấm công của chu kỳ.`);
      await refreshAllData();
      setActiveTab("attendance");
    } catch (err) {
      console.error(err);
      alert("Không thể xóa dữ liệu chấm công.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAudit = async (cycleId: string) => {
    if (!cycleId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/audit/cycles/${cycleId}/run`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || (isAuditOnlyUser ? "Lỗi xử lý dữ liệu" : "Lỗi chạy audit"));
        return;
      }
      await loadAuditAttendanceRecords();
      await loadAuditPayrollSheet();
      setActiveTab("auditSheet");
    } catch (err) {
      console.error(err);
      alert(isAuditOnlyUser ? "Không thể xử lý dữ liệu." : "Không thể chạy audit.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuditConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditConfigStatus(null);
    try {
      setIsLoading(true);
      const res = await fetch("/api/audit/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxOvertimeHoursPerDay: auditDayLimitForm,
          maxOvertimeHoursPerMonth: auditMonthLimitForm,
          maxOvertimeHoursPerYear: auditYearLimitForm,
          allowSundayWork: auditAllowSundayForm,
          enableOvertimeTier2: auditEnableTier2Form,
          note: auditNoteForm,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setAuditConfigStatus(data.error?.message || (isAuditOnlyUser ? "Không cập nhật được cấu hình." : "Không cập nhật được cấu hình audit."));
        return;
      }
      setAuditConfig(data.data);
      setAuditConfigStatus(isAuditOnlyUser ? "Đã lưu cấu hình." : "Đã lưu cấu hình audit.");
    } catch (err) {
      console.error(err);
      setAuditConfigStatus(isAuditOnlyUser ? "Lỗi kết nối khi lưu cấu hình." : "Lỗi kết nối khi lưu cấu hình audit.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCycleStatusChange = async (cycleId: string, status: string, msg: string) => {
    if (!confirm(msg)) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/cycles/${cycleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi đổi trạng thái");
        return;
      }
      await refreshAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCycleDelete = async (cycleId: string) => {
    const cycle = cycles.find((item) => item.id === cycleId);
    if (cycle && cycle.status !== "draft" && cycle.status !== "cancelled") {
      alert("Chỉ có thể xóa chu kỳ ở trạng thái Nháp hoặc Đã hủy. Chu kỳ đã chốt không được xóa.");
      return;
    }

    if (!confirm("Bạn có chắc chắn muốn xóa chu kỳ nháp/đã hủy này? Mọi dữ liệu liên quan đến chu kỳ sẽ bị xóa.")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/cycles/${cycleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Lỗi xóa chu kỳ");
        return;
      }
      await refreshAllData();
      if (cycles.length > 0) setSelectedCycleId(cycles[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload file chấm công
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Vui lòng chọn file Excel hoặc CSV.");
      return;
    }
    if (!selectedCycleId) {
      alert("Vui lòng chọn chu kỳ thanh toán.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("cycleId", selectedCycleId);

    setUploadStatus(null);
    setUploadStep(1); // Uploading file (20%)

    // Simulate progress steps for a smoother experience
    const timer1 = setTimeout(() => setUploadStep(2), 1200); // Parsing Excel rows (40%)
    const timer2 = setTimeout(() => setUploadStep(3), 2400); // Cleaning & Standardizing decimals (60%)
    const timer3 = setTimeout(() => setUploadStep(4), 3600); // Matching missing employees (80%)

    try {
      const res = await fetch("/api/timekeeping/imports", {
        method: "POST",
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const data = await res.json();
      if (!data.success) {
        setUploadStatus(`Lỗi: ${data.error?.message || "Không thể xử lý"}`);
        setUploadStep(0);
        return;
      }

      setUploadStep(5); // Completed (100%)
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshAllData();
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setUploadStatus("Lỗi kết nối.");
      setUploadStep(0);
    }
  };

  // Open Payslip Receipts
  const openPayslipReceipt = async (employeeId: string) => {
    if (!selectedCycleId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/items?cycleId=${selectedCycleId}&employeeId=${employeeId}`);
      const data = await res.json();
      if (data.success) {
        setActivePayslip(data.data);
        setPayslipModalOpen(true);
      } else {
        alert("Không thể tìm thấy phiếu lương.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPayrollExcel = async (source: "standard" | "audit") => {
    if (!selectedCycleId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payroll/items/export?cycleId=${selectedCycleId}&source=${source}`);
      if (!res.ok) {
        alert("Không thể xuất file Excel bảng lương.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `bang-luong-${selectedCycle?.code || "export"}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Không thể xuất file Excel bảng lương.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (confirm("Bạn có muốn đăng xuất?")) {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    }
  };

  const uniqueDepartments = Array.from(
    new Set(employees.map(e => e.departmentName).filter(Boolean))
  ) as string[];

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.departmentName && e.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDept = deptFilter === "all" || e.departmentName === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedEmployees = filteredEmployees.slice(
    (pageEmployees - 1) * limitEmployees,
    pageEmployees * limitEmployees
  );
  const filteredEmployeeIds = filteredEmployees.map((employee) => employee.id);
  const selectedFilteredEmployeeCount = filteredEmployeeIds.filter((id) => selectedEmployeeIds.has(id)).length;
  const allFilteredEmployeesSelected = filteredEmployees.length > 0 && selectedFilteredEmployeeCount === filteredEmployees.length;
  const selectedEmployees = employees.filter((employee) => selectedEmployeeIds.has(employee.id));

  useEffect(() => {
    if (employeeSelectAllRef.current) {
      employeeSelectAllRef.current.indeterminate =
        selectedFilteredEmployeeCount > 0 && !allFilteredEmployeesSelected;
    }
  }, [allFilteredEmployeesSelected, selectedFilteredEmployeeCount]);

  const toggleFilteredEmployeeSelection = () => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (allFilteredEmployeesSelected) {
        filteredEmployeeIds.forEach((id) => next.delete(id));
      } else {
        filteredEmployeeIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const filteredCycles = cycles.filter(c => {
    const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = cycleStatusFilter === "all" || c.status === cycleStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedCycles = filteredCycles.slice(
    (pageCycles - 1) * limitCycles,
    pageCycles * limitCycles
  );

  const filteredRecords = attendanceRecords.filter(r => {
    const matchesSearch = r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "all" || r.departmentName === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedRecords = filteredRecords.slice(
    (pageAttendance - 1) * limitAttendance,
    pageAttendance * limitAttendance
  );

  const filteredSheet = payrollSheetItems.filter(i => {
    const matchesSearch = i.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const emp = employees.find(e => e.id === i.employeeId);
    const empDept = emp?.departmentName || "";
    const matchesDept = deptFilter === "all" || empDept === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedSheet = filteredSheet.slice(
    (pageSheet - 1) * limitSheet,
    pageSheet * limitSheet
  );

  const filteredAuditRecords = auditAttendanceRecords.filter(r => {
    const matchesSearch = r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "all" || r.departmentName === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedAuditRecords = filteredAuditRecords.slice(
    (pageAuditAttendance - 1) * limitAuditAttendance,
    pageAuditAttendance * limitAuditAttendance
  );

  const filteredAuditSheet = auditPayrollSheetItems.filter(i => {
    const matchesSearch = i.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const emp = employees.find(e => e.id === i.employeeId);
    const empDept = emp?.departmentName || "";
    const matchesDept = deptFilter === "all" || empDept === deptFilter;
    return matchesSearch && matchesDept;
  });

  const paginatedAuditSheet = filteredAuditSheet.slice(
    (pageAuditSheet - 1) * limitAuditSheet,
    pageAuditSheet * limitAuditSheet
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-650 border border-zinc-200">Nháp (Draft)</span>;
      case "imported":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Đã Import</span>;
      case "cleaned":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-750 border border-indigo-200">Đã làm sạch</span>;
      case "calculated":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-50 text-yellow-750 border border-yellow-200">Đã tính lương</span>;
      case "locked":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit"><Lock className="w-3 h-3" /> Đã Chốt</span>;
      case "paid":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Đã chi trả</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-650">{status}</span>;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col justify-between shrink-0 shadow-sm z-10">
        <div>
          {/* Logo Brand */}
          <div className="px-6 py-5 border-b border-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/10">
              CF
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-800">Aparel</h2>
              <p className="text-xs text-zinc-400">Hệ thống nội bộ</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab("employees"); setSearchTerm(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "employees" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Nhân sự & Lương riêng</span>
            </button>
            <button
              onClick={() => { setActiveTab("rules"); setSearchTerm(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "rules" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Cấu hình quy tắc chung</span>
            </button>
            {!isAuditOnlyUser && (
              <>
                <button
                  onClick={() => { setActiveTab("cycles"); setSearchTerm(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                    activeTab === "cycles" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span>Chu kỳ lương</span>
                </button>
                <button
                  onClick={() => { setActiveTab("attendance"); setSearchTerm(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                    activeTab === "attendance" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Chấm công gốc</span>
                </button>
                <button
                  onClick={() => { setActiveTab("sheet"); setSearchTerm(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                    activeTab === "sheet" ? "bg-blue-50 text-blue-600 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>Bảng lương gốc</span>
                </button>
                <div className="pt-3 mt-3 border-t border-zinc-150 text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3">
                  Audit
                </div>
                <button
                  onClick={() => { setActiveTab("auditConfig"); setSearchTerm(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                    activeTab === "auditConfig" ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  <SlidersHorizontal className="w-5 h-5" />
                  <span>Cấu hình audit</span>
                </button>
              </>
            )}
            <button
              onClick={() => { setActiveTab("auditAttendance"); setSearchTerm(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "auditAttendance"
                  ? isAuditOnlyUser ? "bg-blue-50 text-blue-600 shadow-sm" : "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>{isAuditOnlyUser ? "Chấm công" : "Chấm công audit"}</span>
            </button>
            <button
              onClick={() => { setActiveTab("auditSheet"); setSearchTerm(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-semibold cursor-pointer text-left ${
                activeTab === "auditSheet"
                  ? isAuditOnlyUser ? "bg-blue-50 text-blue-600 shadow-sm" : "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>{isAuditOnlyUser ? "Bảng lương tổng hợp" : "Bảng lương audit"}</span>
            </button>
          </nav>
        </div>

        {/* Footer Sidebar info */}
        <div className="p-4 border-t border-zinc-100 space-y-1">
          <Link href="/modules" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors font-medium">
            <LayoutGrid className="w-5 h-5" />
            <span>Quay lại Trang chủ</span>
          </Link>
          <div className="text-xs text-zinc-400 py-2 px-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <span>Thông tin bản quyền</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
            <Link href="/modules" className="hover:text-zinc-800">Trang chủ</Link>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <Link href="/payroll" className="hover:text-zinc-800">Quản lý nhân sự</Link>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <span className="text-zinc-800 font-semibold">Chấm công & Tính lương</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              {currentUser.factoryName}
            </span>
          </div>

          {/* User profile details */}
          <div className="flex items-center gap-4">
            {/* Cycle Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Kỳ lương:</label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="bg-white border border-zinc-250 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-500"
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status.toUpperCase()})</option>
                ))}
              </select>
            </div>

            <div className="h-8 w-px bg-zinc-200"></div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-800 leading-none">{currentUser.displayName}</p>
                <p className="text-xs text-zinc-400 mt-1 uppercase font-bold tracking-wider">
                  {currentUser.isAdmin ? "Admin" : currentUser.departmentName || "Thành viên"}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  {currentUser.factoryName}
                </p>
              </div>
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/10">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden bg-zinc-50">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-50">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {/* Tab Views Card */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {activeTab === "auditConfig" && (
              <form onSubmit={handleAuditConfigSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-850">
                      {isAuditOnlyUser ? "Cấu hình quy tắc bảng số 1" : "Cấu hình audit bảng số 1"}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      {isAuditOnlyUser
                        ? "Thiết lập chuẩn làm sạch chấm công trước khi tính lương."
                        : "Cấu hình này chỉ sinh dữ liệu audit, không sửa bảng chấm công và bảng lương gốc."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => selectedCycleId && handleRunAudit(selectedCycleId)}
                      className={`px-4 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${
                        isAuditOnlyUser ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isAuditOnlyUser ? "Làm sạch kỳ này" : "Chạy audit kỳ này"}</span>
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu cấu hình</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl">
                    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">TC1 tối đa / ngày</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={auditDayLimitForm}
                        onChange={(e) => setAuditDayLimitForm(Number(e.target.value))}
                        className="input rounded-xl border-zinc-250 text-sm font-bold"
                      />
                      <p className="text-xs text-zinc-500 mt-2">
                        Nếu vượt mức này, hệ thống trừ từng block để lấy số lẻ còn lại.
                      </p>
                    </div>
                    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">TC1 tối đa / tháng</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={auditMonthLimitForm}
                        onChange={(e) => setAuditMonthLimitForm(Number(e.target.value))}
                        className="input rounded-xl border-zinc-250 text-sm font-bold"
                      />
                      <p className="text-xs text-zinc-500 mt-2">Mặc định 40h/tháng theo yêu cầu khách.</p>
                    </div>
                    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">TC1 tối đa / năm</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={auditYearLimitForm}
                        onChange={(e) => setAuditYearLimitForm(Number(e.target.value))}
                        className="input rounded-xl border-zinc-250 text-sm font-bold"
                      />
                      <p className="text-xs text-zinc-500 mt-2">Mặc định 300h/năm theo yêu cầu khách.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
                    <label className="border border-zinc-200 rounded-lg p-4 flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditAllowSundayForm}
                        onChange={(e) => setAuditAllowSundayForm(e.target.checked)}
                        className="mt-1 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        <span className="block text-sm font-bold text-zinc-800">Cho phép công Chủ Nhật</span>
                        <span className="block text-xs text-zinc-500 mt-1">
                          Tắt mặc định: công và tăng ca Chủ Nhật được đưa về 0.
                        </span>
                      </span>
                    </label>
                    <label className="border border-zinc-200 rounded-lg p-4 flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditEnableTier2Form}
                        onChange={(e) => setAuditEnableTier2Form(e.target.checked)}
                        className="mt-1 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        <span className="block text-sm font-bold text-zinc-800">
                          {isAuditOnlyUser ? "Bật tăng ca 2" : "Bật tăng ca 2 trong audit"}
                        </span>
                        <span className="block text-xs text-zinc-500 mt-1">Tắt mặc định: TC2 được đưa về TC1 trước khi áp dụng giới hạn.</span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-5 max-w-5xl">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Ghi chú cấu hình</label>
                    <textarea
                      value={auditNoteForm}
                      onChange={(e) => setAuditNoteForm(e.target.value)}
                      rows={4}
                      className="input rounded-xl border-zinc-250 text-sm"
                    />
                  </div>

                  <div className="mt-5 max-w-5xl rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div className="font-bold mb-1">
                      Cấu hình đang dùng: {isAuditOnlyUser ? "Bảng số 1" : auditConfig?.name || "Audit bảng số 1"}
                    </div>
                    <div>
                      Ví dụ TC1 = 9h, giới hạn ngày = 4h: hệ thống trừ 4h còn 5h, vẫn lớn hơn 4h nên trừ tiếp, còn 1h để tính lương.
                    </div>
                  </div>

                  {auditConfigStatus && (
                    <div className="mt-4 max-w-5xl text-sm font-semibold text-blue-700">{auditConfigStatus}</div>
                  )}
                </div>
              </form>
            )}

            {activeTab === "auditAttendance" && (() => {
              const totalItems = filteredAuditRecords.length;
              const totalPages = Math.ceil(totalItems / limitAuditAttendance) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={selectedCycleId}
                        onChange={(e) => setSelectedCycleId(e.target.value)}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        {cycles.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageAuditAttendance(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Bộ phận (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm mã, họ tên..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageAuditAttendance(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => selectedCycleId && handleRunAudit(selectedCycleId)}
                      className={`px-4 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${
                        isAuditOnlyUser ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isAuditOnlyUser ? "Cập nhật dữ liệu" : "Chạy lại audit"}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className={`w-full text-left border-collapse text-xs ${isAuditOnlyUser ? "" : "min-w-[1180px]"}`}>
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          {isAuditOnlyUser ? (
                            <>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Mã NV</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Họ Tên</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Ngày</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Công</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Giờ</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Vào 1</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Ra 1</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Trễ</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Sớm</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC1</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC2</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Ký hiệu</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Mã NV</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Họ Tên</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Ngày</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Công gốc</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Công audit</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC1 gốc</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC2 gốc</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC1 audit</th>
                              <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[280px]">Lý do chỉnh</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-650">
                        {paginatedAuditRecords.length === 0 ? (
                          <tr>
                            <td colSpan={isAuditOnlyUser ? 12 : 9} className="px-4 py-8 text-center text-zinc-400">
                              {isAuditOnlyUser ? "Chưa có dữ liệu chấm công cho chu kỳ này." : "Chưa có bảng chấm công audit cho chu kỳ này."}
                            </td>
                          </tr>
                        ) : (
                          paginatedAuditRecords.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-zinc-50/50">
                              {isAuditOnlyUser ? (
                                <>
                                  <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{r.employeeCode}</td>
                                  <td className="px-4 py-2.5 font-semibold text-zinc-850">{r.employeeName}</td>
                                  <td className="px-4 py-2.5">{formatDate(r.workDate)} ({r.weekdayName || "-"})</td>
                                  <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{formatDecimal(r.workdayCount, 1)}</td>
                                  <td className="px-4 py-2.5 text-center font-mono">{formatDecimal(r.workHours, 1)}</td>
                                  <td className="px-4 py-2.5 text-center text-zinc-500">{r.checkIn1 ? r.checkIn1.substring(0,5) : "-"}</td>
                                  <td className="px-4 py-2.5 text-center text-zinc-500">{r.checkOut1 ? r.checkOut1.substring(0,5) : "-"}</td>
                                  <td className="px-4 py-2.5 text-center text-red-650 font-bold">{r.lateMinutes || "-"}</td>
                                  <td className="px-4 py-2.5 text-center text-orange-650 font-bold">{r.earlyLeaveMinutes || "-"}</td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-blue-650">{r.overtimeNormalHours ? formatDecimal(r.overtimeNormalHours, 1) : "-"}</td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-indigo-650">{r.overtimeSundayHours ? formatDecimal(r.overtimeSundayHours, 1) : "-"}</td>
                                  <td className="px-4 py-2.5 font-semibold text-zinc-805">{r.symbol || "-"}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{r.employeeCode}</td>
                                  <td className="px-4 py-2.5 font-semibold text-zinc-850">{r.employeeName}</td>
                                  <td className="px-4 py-2.5">{formatDate(r.workDate)} ({r.weekdayName || "-"})</td>
                                  <td className="px-4 py-2.5 text-center">{formatDecimal(r.originalWorkdayCount, 1)}</td>
                                  <td className="px-4 py-2.5 text-center font-bold text-emerald-650">{formatDecimal(r.workdayCount, 1)}</td>
                                  <td className="px-4 py-2.5 text-center font-mono">{formatDecimal(r.originalOvertimeNormalHours, 1)}h</td>
                                  <td className="px-4 py-2.5 text-center font-mono">{formatDecimal(r.originalOvertimeSundayHours, 1)}h</td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-emerald-700">{formatDecimal(r.overtimeNormalHours, 1)}h</td>
                                  <td className="px-4 py-2.5 text-zinc-500 whitespace-normal">{Array.isArray(r.adjustmentReason) ? r.adjustmentReason.join(" ") : r.note || "-"}</td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold">
                    <div>Hiển thị {(pageAuditAttendance - 1) * limitAuditAttendance + 1}-{Math.min(pageAuditAttendance * limitAuditAttendance, totalItems)} / Tổng: {totalItems}</div>
                    <select
                      value={limitAuditAttendance}
                      onChange={(e) => {
                        setLimitAuditAttendance(Number(e.target.value));
                        setPageAuditAttendance(1);
                      }}
                      className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageAuditAttendance(p => Math.max(1, p - 1))} disabled={pageAuditAttendance === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className={`px-2.5 py-1 text-white rounded-md font-bold mx-1 ${isAuditOnlyUser ? "bg-blue-600" : "bg-emerald-600"}`}>{pageAuditAttendance} / {totalPages}</span>
                      <button onClick={() => setPageAuditAttendance(p => Math.min(totalPages, p + 1))} disabled={pageAuditAttendance === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "auditSheet" && (() => {
              const totalItems = filteredAuditSheet.length;
              const totalPages = Math.ceil(totalItems / limitAuditSheet) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={selectedCycleId}
                        onChange={(e) => setSelectedCycleId(e.target.value)}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        {cycles.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageAuditSheet(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Bộ phận (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm mã, họ tên..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageAuditSheet(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => downloadPayrollExcel("audit")}
                        className="px-3 py-2 border border-zinc-250 hover:bg-zinc-55 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-white text-zinc-700"
                      >
                        <Download className="w-4 h-4" />
                        <span>Xuất Excel</span>
                      </button>
                      <button
                        onClick={() => selectedCycleId && handleRunAudit(selectedCycleId)}
                        className={`px-4 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${
                          isAuditOnlyUser ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isAuditOnlyUser ? "Tính lương" : "Tính lại lương audit"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full min-w-[1180px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Mã NV</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[150px]">Họ và Tên</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">{isAuditOnlyUser ? "Công" : "Công audit"}</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">{isAuditOnlyUser ? "TC1" : "TC1 audit"}</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">{isAuditOnlyUser ? "TC2" : "TC2 audit"}</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right">Lương ngày công</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right">Tiền tăng ca</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right">Tổng thu nhập</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right">Khấu trừ</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right font-bold text-zinc-850">{isAuditOnlyUser ? "Thực nhận" : "Thực nhận audit"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-750">
                        {paginatedAuditSheet.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-zinc-400">
                              {isAuditOnlyUser ? "Chưa có kết quả tính lương cho chu kỳ này." : "Chưa có bảng lương audit cho chu kỳ này."}
                            </td>
                          </tr>
                        ) : (
                          paginatedAuditSheet.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td className="px-4 py-3.5 font-mono font-bold text-zinc-700">{item.employeeCode}</td>
                              <td className="px-4 py-3.5 font-bold text-zinc-800">{item.employeeName}</td>
                              <td className="px-4 py-3.5 text-center font-bold text-zinc-700">{formatDecimal(item.actualWorkdays, 1)}</td>
                              <td className="px-4 py-3.5 text-center font-mono text-emerald-700 font-bold">{formatDecimal(item.overtimeNormalHours, 1)}h</td>
                              <td className="px-4 py-3.5 text-center font-mono">{formatDecimal(item.overtimeSundayHours, 1)}h</td>
                              <td className="px-4 py-3.5 text-right font-semibold">{formatVND(item.monthlySalaryAmount)}</td>
                              <td className="px-4 py-3.5 text-right">{formatVND(parseFloat(item.overtimeNormalAmount) + parseFloat(item.overtimeSundayAmount) + parseFloat(item.overtimeHolidayAmount))}</td>
                              <td className="px-4 py-3.5 text-right font-bold text-blue-600">{formatVND(item.grossIncome)}</td>
                              <td className="px-4 py-3.5 text-right text-red-650">{formatVND(item.totalDeduction)}</td>
                              <td className="px-4 py-3.5 text-right font-bold text-emerald-600 text-sm">{formatVND(item.secondPaymentAmount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold">
                    <div>Hiển thị {(pageAuditSheet - 1) * limitAuditSheet + 1}-{Math.min(pageAuditSheet * limitAuditSheet, totalItems)} / Tổng: {totalItems}</div>
                    <select
                      value={limitAuditSheet}
                      onChange={(e) => {
                        setLimitAuditSheet(Number(e.target.value));
                        setPageAuditSheet(1);
                      }}
                      className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageAuditSheet(p => Math.max(1, p - 1))} disabled={pageAuditSheet === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className={`px-2.5 py-1 text-white rounded-md font-bold mx-1 ${isAuditOnlyUser ? "bg-blue-600" : "bg-emerald-600"}`}>{pageAuditSheet} / {totalPages}</span>
                      <button onClick={() => setPageAuditSheet(p => Math.min(totalPages, p + 1))} disabled={pageAuditSheet === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "employees" && (() => {
              const totalItems = filteredEmployees.length;
              const totalPages = Math.ceil(totalItems / limitEmployees) || 1;
              return (
                <>
                  {/* Card Top Toolbar */}
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm mã, họ tên..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageEmployees(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageEmployees(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Bộ phận (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedEmployeeIds.size > 0 && (
                        <>
                          <button
                            onClick={openBulkSalaryModal}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Gán lương đồng loạt ({selectedEmployeeIds.size})</span>
                          </button>
                          <button
                            onClick={() => setSelectedEmployeeIds(new Set())}
                            className="px-3 py-2 border border-zinc-250 hover:bg-zinc-55 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-white text-zinc-700"
                          >
                            <X className="w-4 h-4" />
                            <span>Bỏ chọn</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openEmployeeModal()}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm nhân sự</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Grid */}
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full min-w-[1040px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 w-10 text-center">
                            <input
                              ref={employeeSelectAllRef}
                              type="checkbox"
                              checked={allFilteredEmployeesSelected}
                              onChange={toggleFilteredEmployeeSelection}
                              disabled={filteredEmployees.length === 0}
                              aria-label="Chọn tất cả nhân viên theo bộ lọc"
                              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[90px]">Mã nhân sự</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[140px]">Họ và Tên</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[70px]">Giới tính</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[130px]">Bộ phận</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[130px]">Chức vụ</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 min-w-[110px]">Ngày gia nhập</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 text-center min-w-[115px]">Người phụ thuộc</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-100 z-20 text-right min-w-[125px]">Lương cấu hình</th>
                          <th className="px-4 py-3.5 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-100 border-l border-zinc-100 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right min-w-[100px]">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-sm">
                        {paginatedEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-zinc-400">Không tìm thấy nhân viên nào.</td>
                          </tr>
                        ) : (
                          paginatedEmployees.map((e) => (
                            <tr key={e.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedEmployeeIds.has(e.id)}
                                  onChange={(event) => handleEmployeeSelectionChange(e.id, event.target.checked)}
                                  aria-label={`Chọn nhân viên ${e.employeeCode}`}
                                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{e.employeeCode}</td>
                              <td className="px-4 py-2.5 font-semibold text-zinc-800">{e.fullName}</td>
                              <td className="px-4 py-2.5 text-zinc-500">{e.gender || "-"}</td>
                              <td className="px-4 py-2.5 font-medium text-zinc-700">{e.departmentName || "-"}</td>
                              <td className="px-4 py-2.5 text-zinc-500">{e.positionTitle || "-"}</td>
                              <td className="px-4 py-2.5 text-zinc-500">{e.joinedDate ? formatDate(e.joinedDate) : "-"}</td>
                              <td className="px-4 py-2.5 text-zinc-500 text-center">
                                {e.dependentCount || 0} {e.hasChildUnder6 && <span className="block text-[10px] text-emerald-600 font-bold">(Có con &lt; 6t)</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => openSalaryConfigModal(e)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-500 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 cursor-pointer"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Cấu hình Lương</span>
                                </button>
                              </td>
                              <td className="px-4 py-2.5 sticky right-0 bg-white border-l border-zinc-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right z-10">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => openEmployeeModal(e)} className="icon-btn hover:text-blue-600 rounded-lg p-1.5 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleEmployeeDelete(e.id)} className="icon-btn-danger hover:bg-red-50 hover:text-red-700 rounded-lg p-1.5 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageEmployees - 1) * limitEmployees + 1}-{Math.min(pageEmployees * limitEmployees, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitEmployees}
                        onChange={(e) => {
                          setLimitEmployees(Number(e.target.value));
                          setPageEmployees(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageEmployees(1)} disabled={pageEmployees === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageEmployees(p => Math.max(1, p - 1))} disabled={pageEmployees === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageEmployees} / {totalPages}</span>
                      <button onClick={() => setPageEmployees(p => Math.min(totalPages, p + 1))} disabled={pageEmployees === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageEmployees(totalPages)} disabled={pageEmployees === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "rules" && (() => {
              const filteredRules = rules.filter(r => 
                r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              const groupedRules = payrollRuleGroups.map((group) => {
                const previousGroups = payrollRuleGroups.slice(0, payrollRuleGroups.findIndex((g) => g.id === group.id));
                return {
                  ...group,
                  rules: filteredRules.filter((rule) => {
                    const code = rule.code || "";
                    const isAlreadyGrouped = previousGroups.some((previousGroup) => previousGroup.matches(code));
                    return !isAlreadyGrouped && group.matches(code);
                  }),
                };
              }).filter(group => group.rules.length > 0);
              return (
                <>
                  {/* Card Top Toolbar */}
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm quy tắc..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table Grid */}
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full min-w-[980px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[220px]">Tên quy tắc</th>
                          <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[220px]">Mã quy tắc</th>
                          <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[130px] text-right">Giá trị cấu hình</th>
                          <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[100px]">Đơn vị</th>
                          <th className="px-5 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[300px]">Mô tả chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-750">
                        {filteredRules.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-zinc-400">Không tìm thấy quy tắc nào.</td>
                          </tr>
                        ) : (
                          groupedRules.map((group) => (
                            <Fragment key={group.id}>
                              <tr className="bg-zinc-100/80">
                                <td colSpan={5} className="px-5 py-3 border-y border-zinc-200">
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-800">{group.title}</p>
                                      <p className="text-xs text-zinc-500 mt-0.5 normal-case tracking-normal">{group.description}</p>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-zinc-250 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-500">
                                      {group.rules.length} quy tắc
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {group.rules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap align-middle">
                                  <td className="px-5 py-3.5 font-semibold text-zinc-800 whitespace-normal">{rule.name}</td>
                                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-650 whitespace-normal break-all">{rule.code}</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <input
                                      type="number"
                                      step="any"
                                      defaultValue={rule.value}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val) && val !== parseFloat(rule.value)) {
                                          handleRuleUpdate(rule.id, rule.code, val);
                                        }
                                      }}
                                      className="w-24 text-right border border-zinc-250 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-850 focus:border-blue-500 outline-none"
                                    />
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-bold text-zinc-600">
                                      {getRuleUnitLabel(rule.unit)}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-zinc-500 whitespace-normal text-xs leading-relaxed" title={rule.description}>
                                    {rule.description}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {activeTab === "cycles" && (() => {
              const totalItems = filteredCycles.length;
              const totalPages = Math.ceil(totalItems / limitCycles) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm kỳ lương..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageCycles(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <select
                        value={cycleStatusFilter}
                        onChange={(e) => {
                          setCycleStatusFilter(e.target.value);
                          setPageCycles(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Trạng thái (Tất cả)</option>
                        <option value="draft">Nháp</option>
                        <option value="imported">Đã Import</option>
                        <option value="cleaned">Đã làm sạch</option>
                        <option value="calculated">Đã tính lương</option>
                        <option value="locked">Đã Chốt</option>
                        <option value="paid">Đã chi trả</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setCycleCodeForm("");
                          setCycleNameForm("");
                          setCycleStartForm("");
                          setCycleEndForm("");
                          setCycleStdWorkdaysForm(26);
                          setCycleNoteForm("");
                          setCycleFormError(null);
                          setCycleModalOpen(true);
                        }}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tạo kỳ lương</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 w-12 text-center">
                            <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                          </th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Mã chu kỳ</th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Tên chu kỳ</th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Khoảng thời gian</th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Ngày công chuẩn</th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Trạng thái</th>
                          <th className="px-6 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right">Hành động tính lương</th>
                          <th className="px-6 py-4 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-200 border-l border-zinc-200 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 text-sm">
                        {paginatedCycles.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-zinc-400">Chưa có chu kỳ tính lương nào được tạo.</td>
                          </tr>
                        ) : (
                          paginatedCycles.map((c) => (
                            <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-6 py-4 text-center">
                                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-zinc-700">{c.code}</td>
                              <td className="px-6 py-4 font-semibold text-zinc-800">{c.name}</td>
                              <td className="px-6 py-4 text-zinc-500">
                                {formatDate(c.periodStart)} &rarr; {formatDate(c.periodEnd)}
                              </td>
                              <td className="px-6 py-4 text-center font-semibold text-zinc-700">{c.standardWorkdays} ngày</td>
                              <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end items-center gap-2">
                                  {(c.status === "draft" || c.status === "imported" || c.status === "cleaned") && (
                                    <button
                                      onClick={() => handleCalculatePayroll(c.id)}
                                      className="px-2.5 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-white rounded-lg text-xs font-bold cursor-pointer"
                                    >
                                      Tính lương
                                    </button>
                                  )}
                                  {c.status === "calculated" && (
                                    <button
                                      onClick={() => handleCycleStatusChange(c.id, "locked", "Chốt bảng lương sẽ khóa mọi dữ liệu và lưu snapshot cố định. Đồng ý khóa?")}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Lock className="w-3.5 h-3.5" /> Chốt & Khóa
                                    </button>
                                  )}
                                  {c.status === "locked" && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleCycleStatusChange(c.id, "cleaned", "Mở khóa chu kỳ sẽ cho phép tính toán lại. Đồng ý mở khóa?")}
                                        className="px-2 py-1 bg-zinc-150 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Unlock className="w-3 h-3" /> Mở khóa
                                      </button>
                                      <button
                                        onClick={() => handleCycleStatusChange(c.id, "paid", "Đánh dấu chu kỳ đã được chi trả lương?")}
                                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Chi trả
                                      </button>
                                    </div>
                                  )}
                                  {c.status === "paid" && (
                                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Đã hoàn thành chi trả</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 sticky right-0 bg-white border-l border-zinc-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-right z-10">
                                <button
                                  onClick={() => handleCycleDelete(c.id)}
                                  disabled={c.status !== "draft" && c.status !== "cancelled"}
                                  className="icon-btn-danger hover:bg-red-50 hover:text-red-700 rounded-lg p-1.5 disabled:opacity-30 cursor-pointer"
                                  title={c.status === "draft" || c.status === "cancelled" ? "Xóa chu kỳ" : "Chỉ chu kỳ Nháp hoặc Đã hủy mới được xóa"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageCycles - 1) * limitCycles + 1}-{Math.min(pageCycles * limitCycles, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitCycles}
                        onChange={(e) => {
                          setLimitCycles(Number(e.target.value));
                          setPageCycles(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageCycles(1)} disabled={pageCycles === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageCycles(p => Math.max(1, p - 1))} disabled={pageCycles === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageCycles} / {totalPages}</span>
                      <button onClick={() => setPageCycles(p => Math.min(totalPages, p + 1))} disabled={pageCycles === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageCycles(totalPages)} disabled={pageCycles === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "attendance" && (() => {
              const totalItems = filteredRecords.length;
              const totalPages = Math.ceil(totalItems / limitAttendance) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-500">Chu kỳ:</span>
                        <select
                          value={selectedCycleId}
                          onChange={(e) => setSelectedCycleId(e.target.value)}
                          className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                        >
                          {cycles.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageAttendance(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Bộ phận (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm mã, họ tên..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageAttendance(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDeleteImportedAttendance}
                        disabled={!selectedCycleId || selectedCycle?.status === "draft" || isSelectedCycleReadOnly}
                        className="px-3 py-2 border border-red-200 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-white text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Xóa chấm công</span>
                      </button>
                      <button
                        onClick={() => {
                          if (isSelectedCycleReadOnly) {
                            alert("Chu kỳ lương này đã khóa hoặc chi trả, không thể tải lên chấm công mới.");
                            return;
                          }
                          setUploadFile(null);
                          setUploadStep(0);
                          setUploadStatus(null);
                          setUploadModalOpen(true);
                        }}
                        className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10 px-4 py-2 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Import Excel / CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 w-12 text-center">
                            <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                          </th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Mã NV</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Họ Tên</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Ngày</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Công</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Giờ</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Vào 1</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Ra 1</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Trễ</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">Sớm</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC1</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center">TC2</th>
                          <th className="px-4 py-3.5 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20">Ký hiệu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-650">
                        {paginatedRecords.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-4 py-8 text-center text-zinc-400">Chưa có dữ liệu chấm công được import cho chu kỳ này.</td>
                          </tr>
                        ) : (
                          paginatedRecords.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-zinc-50/50">
                              <td className="px-4 py-2.5 text-center">
                                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{r.employeeCode}</td>
                              <td className="px-4 py-2.5 font-semibold text-zinc-850">{r.employeeName}</td>
                              <td className="px-4 py-2.5">{formatDate(r.workDate)} ({r.weekdayName})</td>
                              <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{formatDecimal(r.workdayCount, 1)}</td>
                              <td className="px-4 py-2.5 text-center font-mono">{formatDecimal(r.workHours, 1)}</td>
                              <td className="px-4 py-2.5 text-center text-zinc-500">{r.checkIn1 ? r.checkIn1.substring(0,5) : "-"}</td>
                              <td className="px-4 py-2.5 text-center text-zinc-500">{r.checkOut1 ? r.checkOut1.substring(0,5) : "-"}</td>
                              <td className="px-4 py-2.5 text-center text-red-650 font-bold">{r.lateMinutes || "-"}</td>
                              <td className="px-4 py-2.5 text-center text-orange-650 font-bold">{r.earlyLeaveMinutes || "-"}</td>
                              <td className="px-4 py-2.5 text-center font-mono font-bold text-blue-650">{r.overtimeNormalHours ? formatDecimal(r.overtimeNormalHours, 1) : "-"}</td>
                              <td className="px-4 py-2.5 text-center font-mono font-bold text-indigo-650">{r.overtimeSundayHours ? formatDecimal(r.overtimeSundayHours, 1) : "-"}</td>
                              <td className="px-4 py-2.5 font-semibold text-zinc-805">{r.symbol || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageAttendance - 1) * limitAttendance + 1}-{Math.min(pageAttendance * limitAttendance, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitAttendance}
                        onChange={(e) => {
                          setLimitAttendance(Number(e.target.value));
                          setPageAttendance(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageAttendance(1)} disabled={pageAttendance === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageAttendance(p => Math.max(1, p - 1))} disabled={pageAttendance === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageAttendance} / {totalPages}</span>
                      <button onClick={() => setPageAttendance(p => Math.min(totalPages, p + 1))} disabled={pageAttendance === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageAttendance(totalPages)} disabled={pageAttendance === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}

            {activeTab === "sheet" && (() => {
              const totalItems = filteredSheet.length;
              const totalPages = Math.ceil(totalItems / limitSheet) || 1;
              return (
                <>
                  <div className="px-6 py-4 border-b border-zinc-150 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-500">Chu kỳ:</span>
                        <select
                          value={selectedCycleId}
                          onChange={(e) => setSelectedCycleId(e.target.value)}
                          className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                        >
                          {cycles.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <select
                        value={deptFilter}
                        onChange={(e) => {
                          setDeptFilter(e.target.value);
                          setPageSheet(1);
                        }}
                        className="border border-zinc-250 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-zinc-700 outline-none cursor-pointer"
                      >
                        <option value="all">Bộ phận (Tất cả)</option>
                        {uniqueDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm mã, họ tên..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPageSheet(1);
                          }}
                          className="pl-10 pr-4 py-2 bg-white border border-zinc-250 rounded-xl text-sm w-60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      {selectedCycle?.status === "calculated" && (
                        <button
                          onClick={() => handleCycleStatusChange(selectedCycleId, "locked", "Bạn có muốn chốt bảng lương này? Bảng lương chốt sẽ không thể chỉnh sửa.")}
                          className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" /> Chốt lương
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => selectedCycleId && handleCalculatePayroll(selectedCycleId)}
                        disabled={!selectedCycleId || selectedCycle?.status === "draft" || isSelectedCycleReadOnly}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Cập nhật</span>
                      </button>
                      <button
                        onClick={() => downloadPayrollExcel("standard")}
                        className="px-3 py-2 border border-zinc-250 hover:bg-zinc-55 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-white text-zinc-700"
                      >
                        <Download className="w-4 h-4" />
                        <span>Xuất Excel</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 w-12 text-center">
                            <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                          </th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[70px]">Mã NV</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 min-w-[150px]">Họ và Tên</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center min-w-[70px]">Công</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center min-w-[80px]">Phép/Lễ</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center min-w-[95px]">TC Thường</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-center min-w-[80px]">TC CN</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[130px]">Lương ngày công</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[110px]">Tiền phép/lễ</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[110px]">Tiền tăng ca</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[100px]">Phụ cấp</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[130px]">Tổng thu nhập</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[120px]">Khấu trừ BHXH</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right min-w-[110px]">Thuế TNCN</th>
                          <th className="px-4 py-4 sticky top-0 bg-zinc-50 border-b border-zinc-200 z-20 text-right font-bold text-zinc-850 min-w-[110px]">Thực nhận</th>
                          <th className="px-4 py-4 sticky top-0 right-0 bg-zinc-50 border-b border-zinc-200 border-l border-zinc-200 z-30 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-center min-w-[115px]">Phiếu lương</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-750">
                        {paginatedSheet.length === 0 ? (
                          <tr>
                            <td colSpan={16} className="px-4 py-8 text-center text-zinc-400">Chưa có kết quả tính lương cho chu kỳ này. Hãy tính lương ở tab Chu kỳ.</td>
                          </tr>
                        ) : (
                          paginatedSheet.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors whitespace-nowrap">
                              <td className="px-4 py-3.5 text-center">
                                <input type="checkbox" className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td className="px-4 py-3.5 font-mono font-bold text-zinc-700">{item.employeeCode}</td>
                              <td className="px-4 py-3.5 font-bold text-zinc-800">{item.employeeName}</td>
                              <td className="px-4 py-3.5 text-center font-bold text-zinc-700">{formatDecimal(item.actualWorkdays, 1)}</td>
                              <td className="px-4 py-3.5 text-center text-zinc-500">{formatDecimal(parseFloat(item.paidLeaveDays) + parseFloat(item.holidayDays), 1)}</td>
                              <td className="px-4 py-3.5 text-center font-mono">{formatDecimal(item.overtimeNormalHours, 1)}h</td>
                              <td className="px-4 py-3.5 text-center font-mono">{formatDecimal(item.overtimeSundayHours, 1)}h</td>
                              <td className="px-4 py-3.5 text-right font-semibold text-zinc-750">{formatVND(item.monthlySalaryAmount)}</td>
                              <td className="px-4 py-3.5 text-right text-zinc-600">{formatVND(item.paidLeaveAmount)}</td>
                              <td className="px-4 py-3.5 text-right text-zinc-600">
                                {formatVND(parseFloat(item.overtimeNormalAmount) + parseFloat(item.overtimeSundayAmount) + parseFloat(item.overtimeHolidayAmount))}
                              </td>
                              <td className="px-4 py-3.5 text-right text-zinc-600">{formatVND(item.allowanceAmount)}</td>
                              <td className="px-4 py-3.5 text-right font-bold text-blue-600">{formatVND(item.grossIncome)}</td>
                              <td className="px-4 py-3.5 text-right text-red-650">{formatVND(item.employeeInsuranceAmount)}</td>
                              <td className="px-4 py-3.5 text-right text-red-650">{formatVND(item.personalIncomeTaxAmount)}</td>
                              <td className="px-4 py-3.5 text-right font-bold text-emerald-600 text-sm">{formatVND(item.secondPaymentAmount)}</td>
                              <td className="px-4 py-3.5 sticky right-0 bg-white border-l border-zinc-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.08)] text-center z-10">
                                <button
                                  onClick={() => openPayslipReceipt(item.employeeId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:text-blue-500 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>In phiếu lương</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/50 text-xs text-zinc-500 font-semibold select-none">
                    <div>Hiển thị {(pageSheet - 1) * limitSheet + 1}-{Math.min(pageSheet * limitSheet, totalItems)} / Tổng: {totalItems}</div>
                    <div className="flex items-center gap-2">
                      <span>Số hàng:</span>
                      <select
                        value={limitSheet}
                        onChange={(e) => {
                          setLimitSheet(Number(e.target.value));
                          setPageSheet(1);
                        }}
                        className="bg-white border border-zinc-250 rounded-lg px-2 py-1 outline-none text-xs text-zinc-700 cursor-pointer font-bold"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPageSheet(1)} disabled={pageSheet === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageSheet(p => Math.max(1, p - 1))} disabled={pageSheet === 1} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded-md font-bold mx-1">{pageSheet} / {totalPages}</span>
                      <button onClick={() => setPageSheet(p => Math.min(totalPages, p + 1))} disabled={pageSheet === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPageSheet(totalPages)} disabled={pageSheet === totalPages} className="p-1 border border-zinc-250 hover:bg-white rounded-md disabled:opacity-30 cursor-pointer text-zinc-650"><ChevronsRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </main>
      </div>

      {/* Employee CRUD Dialog Modal */}
      {employeeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800">
                {selectedEmployee ? "Chỉnh sửa hồ sơ nhân sự" : "Thêm mới nhân sự"}
              </h3>
              <button onClick={() => setEmployeeModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmployeeSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm">
                {empFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{empFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mã nhân sự *</label>
                    <input
                      type="text"
                      value={empCodeForm}
                      onChange={(e) => setEmpCodeForm(e.target.value)}
                      placeholder="vd: 16NAT"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Họ và Tên *</label>
                    <input
                      type="text"
                      value={empNameForm}
                      onChange={(e) => setEmpNameForm(e.target.value)}
                      placeholder="vd: Nguyễn Anh Tú"
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Giới tính</label>
                    <select
                      value={empGenderForm}
                      onChange={(e) => setEmpGenderForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Ngày gia nhập</label>
                    <input
                      type="date"
                      value={empJoinForm}
                      onChange={(e) => setEmpJoinForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Bộ phận (Phòng ban)</label>
                    <input
                      type="text"
                      value={empDeptForm}
                      onChange={(e) => setEmpDeptForm(e.target.value)}
                      placeholder="vd: Ban Giám Đốc"
                      className="input rounded-xl border-zinc-250 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Chức danh</label>
                    <input
                      type="text"
                      value={empPosForm}
                      onChange={(e) => setEmpPosForm(e.target.value)}
                      placeholder="vd: Giám Đốc"
                      className="input rounded-xl border-zinc-250 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-zinc-100 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Người phụ thuộc</label>
                    <input
                      type="number"
                      value={empDependentsForm}
                      onChange={(e) => setEmpDependentsForm(parseInt(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 text-sm"
                    />
                  </div>

                  <div className="col-span-2 flex items-center h-full pt-6">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={empChild6Form}
                        onChange={(e) => setEmpChild6Form(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Có con nhỏ dưới 6 tuổi</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Trạng thái hồ sơ</label>
                  <select
                    value={empStatusForm}
                    onChange={(e) => setEmpStatusForm(e.target.value as any)}
                    className="input rounded-xl border-zinc-250 text-sm"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Tạm hoãn hợp đồng</option>
                    <option value="terminated">Đã nghỉ việc</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button type="button" onClick={() => setEmployeeModalOpen(false)} className="btn-secondary rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer">Hủy</button>
                <button type="submit" disabled={isLoading} className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer shadow-md shadow-blue-500/10 flex items-center gap-2">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Salary Configuration Dialog */}
      {bulkSalaryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-zoomIn flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-md text-zinc-800">Gán lương đồng loạt</h3>
                <p className="text-xs text-zinc-400 mt-1 font-semibold">{selectedEmployees.length} nhân viên đã chọn</p>
              </div>
              <button onClick={() => setBulkSalaryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkSalarySubmit}>
              <div className="p-6 space-y-4 text-xs max-h-[68vh] overflow-y-auto">
                {bulkSalaryError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{bulkSalaryError}</span>
                  </div>
                )}

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <div className="font-bold mb-1">Phạm vi áp dụng</div>
                  <div>
                    Cấu hình lương bên dưới sẽ được thêm cho toàn bộ nhân viên đang chọn.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Hiệu lực từ ngày *</label>
                    <input
                      type="date"
                      value={bulkSalaryEffectiveFromForm}
                      onChange={(e) => setBulkSalaryEffectiveFromForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 py-1.5 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Lương đóng bảo hiểm *</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryInsuranceForm}
                      onChange={(e) => setBulkSalaryInsuranceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right font-bold text-zinc-850"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Lương cơ bản *</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryBaseForm}
                      onChange={(e) => setBulkSalaryBaseForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right font-bold text-zinc-850"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Phụ cấp Thâm niên</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalarySeniorityAllowanceForm}
                      onChange={(e) => setBulkSalarySeniorityAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-zinc-150 pt-3">
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Chức danh</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryPositionAllowanceForm}
                      onChange={(e) => setBulkSalaryPositionAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Trách nhiệm</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryResponsibilityAllowanceForm}
                      onChange={(e) => setBulkSalaryResponsibilityAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC An toàn VSSV</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalarySafetyAllowanceForm}
                      onChange={(e) => setBulkSalarySafetyAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Điện thoại</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryPhoneAllowanceForm}
                      onChange={(e) => setBulkSalaryPhoneAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Đi lại (Xăng)</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryTravelAllowanceForm}
                      onChange={(e) => setBulkSalaryTravelAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Nhà ở</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryHousingAllowanceForm}
                      onChange={(e) => setBulkSalaryHousingAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Thưởng Chuyên cần</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryAttendanceBonusForm}
                      onChange={(e) => setBulkSalaryAttendanceBonusForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Thưởng khác</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryOtherBonusForm}
                      onChange={(e) => setBulkSalaryOtherBonusForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Cơm trưa</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkSalaryMealAllowanceForm}
                      onChange={(e) => setBulkSalaryMealAllowanceForm(parseFloat(e.target.value) || 0)}
                      className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={bulkSalaryNoteForm}
                    onChange={(e) => setBulkSalaryNoteForm(e.target.value)}
                    placeholder="vd: Cập nhật lương định kỳ năm 2026..."
                    className="input rounded-xl border-zinc-250 py-1.5 text-xs"
                  />
                </div>

                <div className="max-h-32 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {selectedEmployees.slice(0, 12).map((employee) => (
                      <div key={employee.id} className="rounded-lg bg-white border border-zinc-150 px-2.5 py-1.5 text-xs">
                        <span className="font-mono font-bold text-zinc-700">{employee.employeeCode}</span>
                        <span className="text-zinc-500"> - {employee.fullName}</span>
                      </div>
                    ))}
                  </div>
                  {selectedEmployees.length > 12 && (
                    <div className="mt-2 text-xs font-semibold text-zinc-500 px-1">
                      Và {selectedEmployees.length - 12} nhân viên khác
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button type="button" onClick={() => setBulkSalaryModalOpen(false)} className="btn-secondary rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer">Hủy</button>
                <button type="submit" disabled={isLoading} className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer shadow-md shadow-emerald-500/10 flex items-center gap-2">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Gán lương</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Configurations dialog history & creation */}
      {salaryConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-zoomIn flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-md text-zinc-800">Cấu hình lương nhân viên</h3>
                <p className="text-xs text-zinc-400 mt-1 font-semibold">{selectedEmployee?.employeeCode} - {selectedEmployee?.fullName}</p>
              </div>
              <button onClick={() => setSalaryConfigModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Config Form */}
              <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 uppercase tracking-wider">
                      {salaryConfigFormMode === "edit" ? "Sửa cấu hình lương hiện tại" : "Thêm cấu hình lương mới"}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {salaryConfigFormMode === "edit"
                        ? "Lưu sẽ cập nhật trực tiếp bản ghi đang dùng, không tạo thêm lịch sử."
                        : "Lưu sẽ tạo bản ghi mới và dùng bản ghi này từ ngày hiệu lực."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startNewSalaryConfig}
                    className="btn-secondary rounded-xl text-[11px] px-3 py-1.5 font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm bản ghi mới</span>
                  </button>
                </div>
                
                <form onSubmit={handleSalaryConfigSubmit} className="space-y-4 text-xs">
                  {salaryConfigError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{salaryConfigError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Hiệu lực từ ngày *</label>
                      <input
                        type="date"
                        value={effectiveFromForm}
                        onChange={(e) => setEffectiveFromForm(e.target.value)}
                        className="input rounded-xl border-zinc-250 py-1.5 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Lương đóng bảo hiểm *</label>
                      <input
                        type="number"
                        value={insuranceSalaryForm}
                        onChange={(e) => setInsuranceSalaryForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right font-bold text-zinc-850"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Lương cơ bản *</label>
                      <input
                        type="number"
                        value={baseSalaryForm}
                        onChange={(e) => setBaseSalaryForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right font-bold text-zinc-850"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Phụ cấp Thâm niên</label>
                      <input
                        type="number"
                        value={seniorityAllowanceForm}
                        onChange={(e) => setSeniorityAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1.5 text-xs text-right"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-150 pt-3">
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Chức danh</label>
                      <input
                        type="number"
                        value={posAllowanceForm}
                        onChange={(e) => setPosAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Trách nhiệm</label>
                      <input
                        type="number"
                        value={respAllowanceForm}
                        onChange={(e) => setRespAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC An toàn VSSV</label>
                      <input
                        type="number"
                        value={safetyAllowanceForm}
                        onChange={(e) => setSafetyAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Điện thoại</label>
                      <input
                        type="number"
                        value={phoneAllowanceForm}
                        onChange={(e) => setPhoneAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Đi lại (Xăng)</label>
                      <input
                        type="number"
                        value={travelAllowanceForm}
                        onChange={(e) => setTravelAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Nhà ở</label>
                      <input
                        type="number"
                        value={housingAllowanceForm}
                        onChange={(e) => setHousingAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Thưởng Chuyên cần</label>
                      <input
                        type="number"
                        value={attendanceBonusForm}
                        onChange={(e) => setAttendanceBonusForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Thưởng khác</label>
                      <input
                        type="number"
                        value={otherBonusForm}
                        onChange={(e) => setOtherBonusForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">PC Cơm trưa</label>
                      <input
                        type="number"
                        value={mealAllowanceForm}
                        onChange={(e) => setMealAllowanceForm(parseFloat(e.target.value) || 0)}
                        className="input rounded-xl border-zinc-250 py-1 text-right text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-500 uppercase tracking-wider mb-1">Ghi chú</label>
                    <input
                      type="text"
                      value={salaryNoteForm}
                      onChange={(e) => setSalaryNoteForm(e.target.value)}
                      placeholder="vd: Cập nhật lương định kỳ năm 2026..."
                      className="input rounded-xl border-zinc-250 py-1.5 text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 font-semibold shadow-md shadow-blue-500/10 flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{salaryConfigFormMode === "edit" ? "Lưu cấu hình hiện tại" : "Thêm và sử dụng"}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* History list side */}
              <div className="flex flex-col overflow-hidden">
                <h4 className="font-bold text-sm text-zinc-800 uppercase tracking-wider mb-4">Lịch sử cấu hình lương</h4>
                
                <div className="flex-1 border border-zinc-200 rounded-2xl overflow-y-auto max-h-[420px] p-2 space-y-3">
                  {salaryConfigs.length === 0 ? (
                    <p className="text-zinc-400 text-center py-8 text-xs font-semibold">Chưa cấu hình lương cho nhân viên này.</p>
                  ) : (
                    salaryConfigs.map((c, idx) => {
                      const isEditingThisConfig = salaryConfigFormMode === "edit" && editingSalaryConfigId === c.id;
                      const isOpenConfig = !c.effectiveTo;

                      return (
                      <div key={c.id} className={`border rounded-xl p-3.5 relative hover:bg-zinc-50 transition-colors text-xs ${isEditingThisConfig ? "border-blue-300 bg-blue-50/40" : "border-zinc-150"}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="space-y-1">
                            <span className="font-bold text-zinc-850">Cấu hình #{salaryConfigs.length - idx}</span>
                            {isEditingThisConfig && (
                              <span className="block text-[10px] font-bold text-blue-700">Đang sửa bản ghi này</span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`${isOpenConfig ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"} px-2 py-0.5 rounded-md font-bold text-[10px]`}>
                              {formatDate(c.effectiveFrom)} &rarr; {c.effectiveTo ? formatDate(c.effectiveTo) : "Hiện tại"}
                            </span>
                            {isOpenConfig && (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Đang dùng</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1 text-[11px] text-zinc-600 border-t border-zinc-100 pt-2">
                          <div><span className="text-zinc-450">Lương đóng BH:</span> <strong className="text-zinc-750 font-bold">{formatVND(c.insuranceSalary)}</strong></div>
                          <div><span className="text-zinc-450">Lương cơ bản:</span> <strong className="text-zinc-750 font-bold">{formatVND(c.baseSalary)}</strong></div>
                          <div><span className="text-zinc-450">Phụ cấp thâm niên:</span> <strong>{formatVND(c.seniorityAllowance)}</strong></div>
                          <div className="col-span-2 mt-1 bg-zinc-100/50 p-1.5 rounded-lg"><span className="text-zinc-450 font-semibold">Tổng lương đầy đủ:</span> <strong className="text-blue-600 font-bold text-xs">{formatVND(c.totalSalary)}</strong></div>
                        </div>
                        {c.note && (
                          <p className="text-[10px] text-zinc-400 italic mt-2 bg-zinc-50 p-1 rounded-md">Note: {c.note}</p>
                        )}
                        <div className="flex justify-end gap-2 mt-3">
                          {isOpenConfig ? (
                            <button
                              type="button"
                              onClick={() => editSalaryConfig(c)}
                              disabled={isEditingThisConfig}
                              className="btn-secondary rounded-lg px-2.5 py-1 text-[10px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{isEditingThisConfig ? "Đang sửa" : "Sửa bản này"}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreSalaryConfig(c)}
                              className="btn-secondary rounded-lg px-2.5 py-1 text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Khôi phục</span>
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSalaryConfigModalOpen(false)}
                className="btn-secondary rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Creation Dialog Modal */}
      {cycleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800">Tạo chu kỳ tính lương mới</h3>
              <button onClick={() => setCycleModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCycle}>
              <div className="p-6 space-y-4 text-sm">
                {cycleFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{cycleFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Mã chu kỳ (YYYY-MM) *</label>
                    <input
                      type="text"
                      value={cycleCodeForm}
                      onChange={(e) => setCycleCodeForm(e.target.value)}
                      placeholder="vd: 2026-05"
                      className="input rounded-xl border-zinc-250 text-sm font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Tên chu kỳ *</label>
                    <input
                      type="text"
                      value={cycleNameForm}
                      onChange={(e) => setCycleNameForm(e.target.value)}
                      placeholder="vd: Tháng 05/2026"
                      className="input rounded-xl border-zinc-250 text-sm font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Từ ngày *</label>
                    <input
                      type="date"
                      value={cycleStartForm}
                      onChange={(e) => setCycleStartForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Đến ngày *</label>
                    <input
                      type="date"
                      value={cycleEndForm}
                      onChange={(e) => setCycleEndForm(e.target.value)}
                      className="input rounded-xl border-zinc-250 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Số ngày công chuẩn (ngày) *</label>
                  <input
                    type="number"
                    value={cycleStdWorkdaysForm}
                    onChange={(e) => setCycleStdWorkdaysForm(parseFloat(e.target.value) || 26)}
                    className="input rounded-xl border-zinc-250 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Ghi chú chu kỳ</label>
                  <input
                    type="text"
                    value={cycleNoteForm}
                    onChange={(e) => setCycleNoteForm(e.target.value)}
                    placeholder="vd: Tính lương tháng 5 đầy đủ..."
                    className="input rounded-xl border-zinc-250 text-sm"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                <button type="button" onClick={() => setCycleModalOpen(false)} className="btn-secondary rounded-xl text-sm px-4 py-2 font-semibold cursor-pointer">Hủy</button>
                <button type="submit" disabled={isLoading} className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm px-4 py-2 font-semibold shadow-md shadow-blue-500/10 flex items-center gap-2 cursor-pointer">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Tạo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Receipt Payslip Modal - Replica of docs/phieuluong.csv */}
      {payslipModalOpen && activePayslip && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-zoomIn flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-md text-zinc-800 flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-blue-600" />
                Phiếu Lương Chi Tiết
              </h3>
              <button onClick={() => setPayslipModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt printable container */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-zinc-800" id="printable-payslip">
              <div className="text-center mb-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-900">CÔNG TY TNHH MTV CẨM THIÊN</h4>
                <p className="text-[10px] text-zinc-400 mt-1 uppercase font-bold tracking-wider">Phiếu lương {activePayslip.cycle.name}</p>
                <div className="border-b border-dashed border-zinc-300 w-full mt-4"></div>
              </div>

              {/* Personal Info */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-zinc-450 uppercase font-semibold">Mã số nhân viên:</span>
                  <span className="font-bold text-zinc-850">{activePayslip.payrollItem.employeeCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 uppercase font-semibold">Họ và Tên:</span>
                  <span className="font-bold text-zinc-850">{activePayslip.payrollItem.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 uppercase font-semibold">Tổng lương đầy đủ:</span>
                  <span className="font-bold text-zinc-800">{formatVND(activePayslip.payrollItem.salaryConfigSnapshot.totalSalary)} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 uppercase font-semibold">Lương đóng BH:</span>
                  <span className="font-semibold">{formatVND(activePayslip.payrollItem.salaryConfigSnapshot.insuranceSalary)} ₫</span>
                </div>
              </div>

              <div className="border-b border-dashed border-zinc-300 w-full my-4"></div>

              {/* Earnings Details */}
              <h5 className="font-bold text-zinc-900 uppercase tracking-wider mb-2">Các Khoản Thu Nhập & Phụ Cấp</h5>
              
              <div className="space-y-2">
                {activePayslip.lines
                  .filter((l: any) => l.lineType === "earning" || l.lineType === "allowance")
                  .map((l: any) => (
                    <div key={l.id} className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-zinc-800">{l.lineName}</p>
                        {l.quantity && l.quantity !== 1 && (
                          <p className="text-[9px] text-zinc-400 font-mono mt-0.5">Số lượng: {formatDecimal(l.quantity, 1)} &times; {formatVND(l.rate)}</p>
                        )}
                      </div>
                      <span className="font-bold text-zinc-850 text-right">{formatVND(l.amount)} ₫</span>
                    </div>
                  ))}
              </div>

              <div className="border-b border-dashed border-zinc-300 w-full my-4"></div>

              {/* Deductions Details */}
              <h5 className="font-bold text-zinc-900 uppercase tracking-wider mb-2">Phần Khấu Trừ & Thuế</h5>
              
              <div className="space-y-2">
                {activePayslip.lines
                  .filter((l: any) => l.lineType === "deduction")
                  .map((l: any) => (
                    <div key={l.id} className="flex justify-between items-start">
                      <span className="font-semibold text-zinc-700">{l.lineName}</span>
                      <span className="font-bold text-red-600 text-right">-{formatVND(l.amount)} ₫</span>
                    </div>
                  ))}
              </div>

              <div className="border-b-2 border-zinc-350 w-full my-4"></div>

              {/* Final Sums */}
              <div className="space-y-2 font-bold text-sm">
                <div className="flex justify-between text-zinc-850">
                  <span>TỔNG THU NHẬP:</span>
                  <span>{formatVND(activePayslip.payrollItem.grossIncome)} ₫</span>
                </div>
                <div className="flex justify-between text-red-650">
                  <span>TỔNG KHẤU TRỪ:</span>
                  <span>-{formatVND(activePayslip.payrollItem.totalDeduction)} ₫</span>
                </div>
                <div className="flex justify-between text-emerald-600 text-[13px] border-t border-zinc-200 pt-2.5">
                  <span>LƯƠNG CÒN LẠI (THỰC NHẬN):</span>
                  <span>{formatVND(activePayslip.payrollItem.secondPaymentAmount)} ₫</span>
                </div>
              </div>

              <div className="border-b border-dashed border-zinc-300 w-full my-5"></div>

              <div className="text-center space-y-4">
                <p className="text-[9px] text-zinc-400 italic">Cảm ơn đóng góp của các anh chị đối với công ty !</p>
                <div className="pt-4 flex flex-col items-center">
                  <p className="font-bold text-[10px] uppercase text-zinc-400">Ký nhận</p>
                  <p className="font-bold text-zinc-800 mt-10">{activePayslip.payrollItem.employeeName}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  const printContents = document.getElementById("printable-payslip")?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  if (printContents) {
                    const printWindow = window.open("", "_blank");
                    printWindow?.document.write(`
                      <html>
                        <head>
                          <title>Phiếu Lương - ${activePayslip.payrollItem.employeeName}</title>
                          <style>
                            body { font-family: monospace; padding: 20px; color: #333; }
                            .flex { display: flex; justify-content: space-between; }
                            .text-center { text-align: center; }
                            .font-bold { font-weight: bold; }
                            .mt-4 { margin-top: 1rem; }
                            .mt-10 { margin-top: 2.5rem; }
                            .pt-4 { padding-top: 1rem; }
                            .mb-6 { margin-bottom: 1.5rem; }
                            .mb-4 { margin-bottom: 1rem; }
                            .space-y-1.5 > * { margin-bottom: 0.375rem; }
                            .space-y-2 > * { margin-bottom: 0.5rem; }
                            .border-b { border-bottom: 1px dashed #ccc; }
                            .border-b-2 { border-bottom: 2px solid #333; }
                            .text-right { text-align: right; }
                            .text-xs { font-size: 12px; }
                            .text-sm { font-size: 14px; }
                          </style>
                        </head>
                        <body>
                          ${printContents}
                        </body>
                      </html>
                    `);
                    printWindow?.document.close();
                    printWindow?.print();
                  }
                }}
                className="btn-secondary rounded-xl text-xs px-4 py-2 font-semibold flex items-center gap-1.5 cursor-pointer bg-white text-zinc-700"
              >
                <Printer className="w-4 h-4" />
                <span>In Phiếu Lương</span>
              </button>
              <button
                type="button"
                onClick={() => setPayslipModalOpen(false)}
                className="btn-secondary rounded-xl text-xs px-4 py-2 font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-zoomIn">
            <div className="px-6 py-4 border-b border-zinc-150 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-bold text-md text-zinc-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Tải lên bảng chấm công thô
              </h3>
              <button 
                onClick={() => {
                  if (uploadStep === 0 || uploadStep === 5) {
                    setUploadModalOpen(false);
                    setUploadStep(0);
                    setUploadStatus(null);
                  } else {
                    alert("Hệ thống đang xử lý tải lên, vui lòng đợi...");
                  }
                }} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFileUpload}>
              <div className="p-6 space-y-5 text-sm">
                {uploadStatus && uploadStep === 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{uploadStatus}</span>
                  </div>
                )}

                {uploadStep === 0 ? (
                  /* Select File Phase */
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-zinc-250 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer relative bg-white transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
                      <span className="block text-sm font-bold text-zinc-700">Kéo thả file hoặc Click để chọn</span>
                      <span className="block text-xs text-zinc-450 mt-1.5">Chấp nhận định dạng Excel (.xlsx) hoặc CSV thô</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept=".csv,.xlsx,.xls"
                      />
                    </div>

                    {uploadFile && (
                      <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center justify-between font-semibold">
                        <span className="truncate max-w-[80%]">{uploadFile.name}</span>
                        <button type="button" onClick={() => setUploadFile(null)} className="text-zinc-400 hover:text-zinc-650 cursor-pointer"><X className="w-4 h-4" /></button>
                      </div>
                    )}

                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-500 flex gap-2">
                      <Info className="w-4 h-4 shrink-0 text-blue-500" />
                      <span>Hệ thống sẽ chuẩn hóa số thập phân tiếng Việt, trễ/sớm và tự động bổ sung nhân sự mới nếu chưa tồn tại.</span>
                    </div>
                  </div>
                ) : (
                  /* Uploading / Processing Phase */
                  <div className="space-y-5 py-4">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      {uploadStep === 5 ? (
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                          <Check className="w-7 h-7" />
                        </div>
                      ) : (
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                      )}
                      
                      <div className="space-y-1">
                        <h4 className="font-bold text-zinc-800 text-sm">
                          {uploadStep === 1 && "Đang tải file lên máy chủ..."}
                          {uploadStep === 2 && "Đang phân tích định dạng file..."}
                          {uploadStep === 3 && "Đang làm sạch và chuẩn hóa dữ liệu..."}
                          {uploadStep === 4 && "Đang tự động bổ sung nhân sự thiếu..."}
                          {uploadStep === 5 && "Đã hoàn thành xử lý chấm công!"}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {uploadStep !== 5 ? "Vui lòng không đóng trình duyệt hoặc tải lại trang..." : "Dữ liệu chấm công đã sẵn sàng để đối chiếu."}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="w-full h-2.5 bg-zinc-150 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${uploadStep === 5 ? "bg-emerald-500" : "bg-blue-600"}`}
                          style={{ width: `${(uploadStep / 5) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <span>Bắt đầu</span>
                        <span>{Math.round((uploadStep / 5) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-zinc-150 bg-zinc-50 flex justify-end gap-3">
                {uploadStep === 0 ? (
                  <>
                    <button 
                      type="button" 
                      onClick={() => setUploadModalOpen(false)} 
                      className="btn-secondary rounded-xl text-xs px-4 py-2 font-semibold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={!uploadFile}
                      className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs px-4 py-2 font-semibold cursor-pointer shadow-md shadow-blue-500/10 disabled:opacity-50"
                    >
                      Bắt đầu xử lý
                    </button>
                  </>
                ) : (
                  uploadStep === 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadModalOpen(false);
                        setUploadStep(0);
                        setUploadStatus(null);
                      }}
                      className="btn-primary bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs px-4 py-2 font-semibold cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      Đóng cửa sổ
                    </button>
                  )
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
