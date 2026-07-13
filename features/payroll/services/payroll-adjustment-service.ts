import { query, queryOne } from "@/lib/db";

export interface PayrollAdjustmentInput {
  employeeId: string;
  annualLeaveTotal?: number;
  paidLeaveHours?: number;
  annualLeaveUsedCumulative?: number;
  annualLeaveRemaining?: number;
  personalLeaveDays?: number;
  personalLeaveAmount?: number;
  businessTripAllowance?: number;
  complianceBonus?: number;
  workTripSupport?: number;
  nightShiftHours?: number;
  nightShiftAmount?: number;
  excessOvertimeNormalHours?: number;
  excessOvertimeSundayHours?: number;
  excessOvertimeHolidayHours?: number;
  excessOvertimeNormalAmount?: number;
  excessOvertimeSundayAmount?: number;
  excessOvertimeHolidayAmount?: number;
  advancePayment1?: number;
  advancePayment2?: number;
  pendingLeaveAdvance?: number;
  otherAllowanceAmount?: number;
  actualWorkdaysOverride?: number | null;
  paidLeaveDaysOverride?: number | null;
  unpaidLeaveDaysOverride?: number | null;
  holidayDaysOverride?: number | null;
  overtimeNormalHoursOverride?: number | null;
  overtimeSundayHoursOverride?: number | null;
  overtimeHolidayHoursOverride?: number | null;
  employeeInsuranceAmountOverride?: number | null;
  unionFeeAmountOverride?: number | null;
  personalIncomeTaxAmountOverride?: number | null;
  menstrualAllowanceAmountOverride?: number | null;
  childAllowanceAmountOverride?: number | null;
  note?: string | null;
}

const adjustmentSelect = `
  pa.id,
  e.id as "employeeId",
  e.employee_code as "employeeCode",
  e.full_name as "employeeName",
  e.department_name as "departmentName",
  e.position_title as "positionTitle",
  COALESCE(pa.annual_leave_total, 0) as "annualLeaveTotal",
  COALESCE(pa.paid_leave_hours, 0) as "paidLeaveHours",
  COALESCE(pa.annual_leave_used_cumulative, 0) as "annualLeaveUsedCumulative",
  COALESCE(pa.annual_leave_remaining, 0) as "annualLeaveRemaining",
  COALESCE(pa.personal_leave_days, 0) as "personalLeaveDays",
  COALESCE(pa.personal_leave_amount, 0) as "personalLeaveAmount",
  COALESCE(pa.business_trip_allowance, 0) as "businessTripAllowance",
  COALESCE(pa.compliance_bonus, 0) as "complianceBonus",
  COALESCE(pa.work_trip_support, 0) as "workTripSupport",
  COALESCE(pa.night_shift_hours, 0) as "nightShiftHours",
  COALESCE(pa.night_shift_amount, 0) as "nightShiftAmount",
  COALESCE(pa.excess_overtime_normal_hours, 0) as "excessOvertimeNormalHours",
  COALESCE(pa.excess_overtime_sunday_hours, 0) as "excessOvertimeSundayHours",
  COALESCE(pa.excess_overtime_holiday_hours, 0) as "excessOvertimeHolidayHours",
  COALESCE(pa.excess_overtime_normal_amount, 0) as "excessOvertimeNormalAmount",
  COALESCE(pa.excess_overtime_sunday_amount, 0) as "excessOvertimeSundayAmount",
  COALESCE(pa.excess_overtime_holiday_amount, 0) as "excessOvertimeHolidayAmount",
  COALESCE(pa.advance_payment_1, 0) as "advancePayment1",
  COALESCE(pa.advance_payment_2, 0) as "advancePayment2",
  COALESCE(pa.pending_leave_advance, 0) as "pendingLeaveAdvance",
  COALESCE(pa.other_allowance_amount, 0) as "otherAllowanceAmount",
  pa.actual_workdays_override as "actualWorkdaysOverride",
  pa.paid_leave_days_override as "paidLeaveDaysOverride",
  pa.unpaid_leave_days_override as "unpaidLeaveDaysOverride",
  pa.holiday_days_override as "holidayDaysOverride",
  pa.overtime_normal_hours_override as "overtimeNormalHoursOverride",
  pa.overtime_sunday_hours_override as "overtimeSundayHoursOverride",
  pa.overtime_holiday_hours_override as "overtimeHolidayHoursOverride",
  pa.employee_insurance_amount_override as "employeeInsuranceAmountOverride",
  pa.union_fee_amount_override as "unionFeeAmountOverride",
  pa.personal_income_tax_amount_override as "personalIncomeTaxAmountOverride",
  pa.menstrual_allowance_amount_override as "menstrualAllowanceAmountOverride",
  pa.child_allowance_amount_override as "childAllowanceAmountOverride",
  pa.note
`;

function toNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return toNumber(value);
}

export class PayrollAdjustmentService {
  static async getAdjustments(cycleId: string, factoryId: string, search?: string) {
    let sql = `
      SELECT ${adjustmentSelect}
      FROM payroll_cycles c
      JOIN employees e ON e.factory_id = c.factory_id
        AND e.deleted_at IS NULL
        AND e.status = 'active'
      LEFT JOIN payroll_adjustments pa ON pa.payroll_cycle_id = c.id
        AND pa.employee_id = e.id
      WHERE c.id = $1
        AND c.factory_id = $2
        AND EXISTS (
          SELECT 1 FROM attendance_records ar
          WHERE ar.payroll_cycle_id = c.id AND ar.employee_id = e.id
        )`;
    const params: any[] = [cycleId, factoryId];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (e.employee_code ILIKE $3 OR e.full_name ILIKE $3 OR e.department_name ILIKE $3)`;
    }

    sql += ` ORDER BY e.employee_code ASC`;
    return await query(sql, params);
  }

  static async upsertAdjustment(cycleId: string, factoryId: string, data: PayrollAdjustmentInput) {
    const cycle = await queryOne(
      `SELECT id FROM payroll_cycles WHERE id = $1 AND factory_id = $2`,
      [cycleId, factoryId]
    );
    if (!cycle) throw new Error("Không tìm thấy chu kỳ lương.");

    const employee = await queryOne(
      `SELECT id FROM employees WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
      [data.employeeId, factoryId]
    );
    if (!employee) throw new Error("Không tìm thấy nhân viên trong xưởng hiện tại.");

    return await queryOne(
      `INSERT INTO payroll_adjustments (
         payroll_cycle_id, employee_id, annual_leave_total, paid_leave_hours,
         annual_leave_used_cumulative, annual_leave_remaining, personal_leave_days,
         personal_leave_amount, business_trip_allowance, compliance_bonus, work_trip_support,
         night_shift_hours, night_shift_amount, excess_overtime_normal_hours,
         excess_overtime_sunday_hours, excess_overtime_holiday_hours,
         excess_overtime_normal_amount, excess_overtime_sunday_amount, excess_overtime_holiday_amount,
         advance_payment_1, advance_payment_2, pending_leave_advance, other_allowance_amount,
         actual_workdays_override, paid_leave_days_override, unpaid_leave_days_override, holiday_days_override,
         overtime_normal_hours_override, overtime_sunday_hours_override, overtime_holiday_hours_override,
         employee_insurance_amount_override, union_fee_amount_override, personal_income_tax_amount_override,
         menstrual_allowance_amount_override, child_allowance_amount_override, note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
       ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE
       SET annual_leave_total = EXCLUDED.annual_leave_total,
           paid_leave_hours = EXCLUDED.paid_leave_hours,
           annual_leave_used_cumulative = EXCLUDED.annual_leave_used_cumulative,
           annual_leave_remaining = EXCLUDED.annual_leave_remaining,
           personal_leave_days = EXCLUDED.personal_leave_days,
           personal_leave_amount = EXCLUDED.personal_leave_amount,
           business_trip_allowance = EXCLUDED.business_trip_allowance,
           compliance_bonus = EXCLUDED.compliance_bonus,
           work_trip_support = EXCLUDED.work_trip_support,
           night_shift_hours = EXCLUDED.night_shift_hours,
           night_shift_amount = EXCLUDED.night_shift_amount,
           excess_overtime_normal_hours = EXCLUDED.excess_overtime_normal_hours,
           excess_overtime_sunday_hours = EXCLUDED.excess_overtime_sunday_hours,
           excess_overtime_holiday_hours = EXCLUDED.excess_overtime_holiday_hours,
           excess_overtime_normal_amount = EXCLUDED.excess_overtime_normal_amount,
           excess_overtime_sunday_amount = EXCLUDED.excess_overtime_sunday_amount,
           excess_overtime_holiday_amount = EXCLUDED.excess_overtime_holiday_amount,
           advance_payment_1 = EXCLUDED.advance_payment_1,
           advance_payment_2 = EXCLUDED.advance_payment_2,
           pending_leave_advance = EXCLUDED.pending_leave_advance,
           other_allowance_amount = EXCLUDED.other_allowance_amount,
           actual_workdays_override = EXCLUDED.actual_workdays_override,
           paid_leave_days_override = EXCLUDED.paid_leave_days_override,
           unpaid_leave_days_override = EXCLUDED.unpaid_leave_days_override,
           holiday_days_override = EXCLUDED.holiday_days_override,
           overtime_normal_hours_override = EXCLUDED.overtime_normal_hours_override,
           overtime_sunday_hours_override = EXCLUDED.overtime_sunday_hours_override,
           overtime_holiday_hours_override = EXCLUDED.overtime_holiday_hours_override,
           employee_insurance_amount_override = EXCLUDED.employee_insurance_amount_override,
           union_fee_amount_override = EXCLUDED.union_fee_amount_override,
           personal_income_tax_amount_override = EXCLUDED.personal_income_tax_amount_override,
           menstrual_allowance_amount_override = EXCLUDED.menstrual_allowance_amount_override,
           child_allowance_amount_override = EXCLUDED.child_allowance_amount_override,
           note = EXCLUDED.note,
           updated_at = now()
       RETURNING id`,
      [
        cycleId,
        data.employeeId,
        toNumber(data.annualLeaveTotal),
        toNumber(data.paidLeaveHours),
        toNumber(data.annualLeaveUsedCumulative),
        toNumber(data.annualLeaveRemaining),
        toNumber(data.personalLeaveDays),
        toNumber(data.personalLeaveAmount),
        toNumber(data.businessTripAllowance),
        toNumber(data.complianceBonus),
        toNumber(data.workTripSupport),
        toNumber(data.nightShiftHours),
        toNumber(data.nightShiftAmount),
        toNumber(data.excessOvertimeNormalHours),
        toNumber(data.excessOvertimeSundayHours),
        toNumber(data.excessOvertimeHolidayHours),
        toNumber(data.excessOvertimeNormalAmount),
        toNumber(data.excessOvertimeSundayAmount),
        toNumber(data.excessOvertimeHolidayAmount),
        toNumber(data.advancePayment1),
        toNumber(data.advancePayment2),
        toNumber(data.pendingLeaveAdvance),
        toNumber(data.otherAllowanceAmount),
        toOptionalNumber(data.actualWorkdaysOverride),
        toOptionalNumber(data.paidLeaveDaysOverride),
        toOptionalNumber(data.unpaidLeaveDaysOverride),
        toOptionalNumber(data.holidayDaysOverride),
        toOptionalNumber(data.overtimeNormalHoursOverride),
        toOptionalNumber(data.overtimeSundayHoursOverride),
        toOptionalNumber(data.overtimeHolidayHoursOverride),
        toOptionalNumber(data.employeeInsuranceAmountOverride),
        toOptionalNumber(data.unionFeeAmountOverride),
        toOptionalNumber(data.personalIncomeTaxAmountOverride),
        toOptionalNumber(data.menstrualAllowanceAmountOverride),
        toOptionalNumber(data.childAllowanceAmountOverride),
        data.note || null,
      ]
    );
  }

  static async upsertAdjustments(cycleId: string, factoryId: string, items: PayrollAdjustmentInput[]) {
    const results = [];
    for (const item of items) {
      results.push(await this.upsertAdjustment(cycleId, factoryId, item));
    }
    return results;
  }
}
