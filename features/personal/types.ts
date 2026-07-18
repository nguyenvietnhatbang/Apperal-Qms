export interface PersonalUser {
  displayName: string;
  factoryName: string;
  employeeId: string | null;
}

export interface AttendanceRecord {
  workDate: string;
  workdayCount: string | number;
  workHours: string | number;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: string | number;
  earlyLeaveMinutes: string | number;
  overtimeHours: string | number;
  symbol: string | null;
}

export interface PayrollSummary {
  cycleId: string;
  cycleName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  actualWorkdays?: string | number;
  paidLeaveDays?: string | number;
  unpaidLeaveDays?: string | number;
  holidayDays?: string | number;
  overtimeHours?: string | number;
  overtimeSundayHours?: string | number;
  overtimeHolidayHours?: string | number;
  monthlySalaryAmount?: string | number;
  allowanceAmount?: string | number;
  otherAllowanceAmount?: string | number;
  businessTripAllowance?: string | number;
  complianceBonus?: string | number;
  workTripSupport?: string | number;
  nightShiftAmount?: string | number;
  grossIncome?: string | number;
  employeeInsuranceAmount?: string | number;
  unionFeeAmount?: string | number;
  personalIncomeTaxAmount?: string | number;
  advancePayment1?: string | number;
  advancePayment2?: string | number;
  pendingLeaveAdvance?: string | number;
  totalDeduction?: string | number;
  netSalary?: string | number;
  estimatedNetSalary?: string | number;
  note?: string | null;
}

export interface SalaryConfig {
  effectiveFrom: string;
  effectiveTo: string | null;
  totalSalary: string | number;
  insuranceSalary: string | number;
  baseSalary: string | number;
  positionAllowance: string | number;
  responsibilityAllowance: string | number;
  seniorityAllowance: string | number;
  safetyAllowance: string | number;
  phoneAllowance: string | number;
  travelAllowance: string | number;
  housingAllowance: string | number;
  attendanceBonus: string | number;
  otherBonus: string | number;
  mealAllowance: string | number;
  note: string | null;
}

export interface PersonalOverview {
  profile: {
    employeeCode: string;
    fullName: string;
    departmentName: string | null;
    positionTitle: string | null;
    joinedDate: string | null;
    status: string;
  };
  attendance: AttendanceRecord[];
  payrollHistory: PayrollSummary[];
  pendingPayrolls: PayrollSummary[];
  salaryConfig: SalaryConfig | null;
}
