import { query, queryOne, transaction } from "@/lib/db";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import {
  AuditRuleConfig,
  auditDailyAttendance,
} from "./audit-rule-utils";

interface AuditConfigRow {
  id: string;
  code: string;
  name: string;
  max_overtime_hours_per_day: string;
  max_overtime_hours_per_month: string;
  max_overtime_hours_per_year: string;
  allow_sunday_work: boolean;
  enable_overtime_tier_2: boolean;
  note: string | null;
}

function toNumber(value: unknown) {
  return Number.parseFloat(String(value || 0)) || 0;
}

function mapAuditConfig(row: AuditConfigRow): AuditRuleConfig & {
  id: string;
  code: string;
  name: string;
  note: string | null;
} {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    maxOvertimeHoursPerDay: toNumber(row.max_overtime_hours_per_day),
    maxOvertimeHoursPerMonth: toNumber(row.max_overtime_hours_per_month),
    maxOvertimeHoursPerYear: toNumber(row.max_overtime_hours_per_year),
    allowSundayWork: row.allow_sunday_work,
    enableOvertimeTier2: row.enable_overtime_tier_2,
    note: row.note,
  };
}

export class AuditService {
  static async getActiveConfig() {
    const config = await queryOne<AuditConfigRow>(
      `SELECT id, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
              max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note
       FROM audit_configs
       WHERE code = 'default' AND is_active = true`
    );

    if (!config) {
      throw new Error("Chưa có cấu hình audit mặc định.");
    }

    return mapAuditConfig(config);
  }

  static async updateActiveConfig(data: Partial<AuditRuleConfig> & { note?: string | null }) {
    const updated = await queryOne<AuditConfigRow>(
      `UPDATE audit_configs
       SET max_overtime_hours_per_day = COALESCE($1, max_overtime_hours_per_day),
           max_overtime_hours_per_month = COALESCE($2, max_overtime_hours_per_month),
           max_overtime_hours_per_year = COALESCE($3, max_overtime_hours_per_year),
           allow_sunday_work = COALESCE($4, allow_sunday_work),
           enable_overtime_tier_2 = COALESCE($5, enable_overtime_tier_2),
           note = COALESCE($6, note),
           updated_at = now()
       WHERE code = 'default'
       RETURNING id, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
                 max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note`,
      [
        data.maxOvertimeHoursPerDay ?? null,
        data.maxOvertimeHoursPerMonth ?? null,
        data.maxOvertimeHoursPerYear ?? null,
        data.allowSundayWork ?? null,
        data.enableOvertimeTier2 ?? null,
        data.note ?? null,
      ]
    );

    if (!updated) throw new Error("Không cập nhật được cấu hình audit.");
    return mapAuditConfig(updated);
  }

  static async generateAuditAttendance(cycleId: string, actorId: string, factoryId: string) {
    const config = await this.getActiveConfig();

    return await transaction(async (client) => {
      const cycleRes = await client.query(
        `SELECT id, factory_id, code, period_start, period_end
         FROM payroll_cycles
         WHERE id = $1 AND factory_id = $2`,
        [cycleId, factoryId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");

      const cycle = cycleRes.rows[0];
      const yearStart = `${new Date(cycle.period_start).getUTCFullYear()}-01-01`;

      const sourceRes = await client.query(
        `WITH cycle_attendance AS (
           SELECT DISTINCT ON (COALESCE(employee_id::text, employee_code), work_date)
                  id, payroll_cycle_id, employee_id, employee_code, employee_name, work_date, weekday_name,
                  department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2,
                  check_in_3, check_out_3, workday_count, work_hours, late_minutes, early_leave_minutes,
                  overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, symbol, extra_symbol, total_hours,
                  updated_at, created_at
           FROM attendance_records
           WHERE work_date >= $1::date
             AND work_date <= $2::date
             AND employee_id IN (
               SELECT id FROM employees WHERE factory_id = $3 AND deleted_at IS NULL
             )
           ORDER BY COALESCE(employee_id::text, employee_code), work_date, updated_at DESC, created_at DESC, id DESC
         )
         SELECT id, payroll_cycle_id, employee_id, employee_code, employee_name, work_date, weekday_name,
                department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2,
                check_in_3, check_out_3, workday_count, work_hours, late_minutes, early_leave_minutes,
                overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, symbol, extra_symbol, total_hours
         FROM cycle_attendance
         ORDER BY employee_code ASC, work_date ASC`,
        [cycle.period_start, cycle.period_end, cycle.factory_id]
      );

      await client.query(`DELETE FROM audit_payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
      await client.query(`DELETE FROM audit_attendance_records WHERE payroll_cycle_id = $1`, [cycleId]);

      const employeeYearTotals = new Map<string, number>();
      const employeeMonthTotals = new Map<string, number>();

      const yearTotalsRes = await client.query(
        `SELECT employee_code, COALESCE(SUM(overtime_normal_hours), 0) as total
         FROM audit_attendance_records
         WHERE work_date >= $1
           AND work_date < $2
           AND payroll_cycle_id <> $3
           AND employee_id IN (
             SELECT id FROM employees WHERE factory_id = $4 AND deleted_at IS NULL
           )
         GROUP BY employee_code`,
        [yearStart, cycle.period_start, cycleId, cycle.factory_id]
      );
      for (const row of yearTotalsRes.rows) {
        employeeYearTotals.set(row.employee_code, toNumber(row.total));
      }

      let adjustedRows = 0;
      const auditRows: any[] = [];
      for (const source of sourceRes.rows) {
        const audited = auditDailyAttendance(
          {
            workDate: source.work_date,
            weekdayName: source.weekday_name,
            workdayCount: toNumber(source.workday_count),
            workHours: toNumber(source.work_hours),
            overtimeNormalHours: toNumber(source.overtime_normal_hours),
            overtimeSundayHours: toNumber(source.overtime_sunday_hours),
            overtimeHolidayHours: toNumber(source.overtime_holiday_hours),
          },
          config
        );

        const employeeCode = source.employee_code;
        const monthTotal = employeeMonthTotals.get(employeeCode) || 0;
        const yearTotal = employeeYearTotals.get(employeeCode) || 0;
        const monthRemaining = Math.max(0, config.maxOvertimeHoursPerMonth - monthTotal);
        const yearRemaining = Math.max(0, config.maxOvertimeHoursPerYear - yearTotal);
        const cappedOvertime = Math.min(audited.overtimeNormalHours, monthRemaining, yearRemaining);
        const reasons = [...audited.reasons];

        if (cappedOvertime !== audited.overtimeNormalHours) {
          reasons.push("TC1 bị giới hạn theo trần 40h/tháng hoặc 300h/năm.");
        }

        employeeMonthTotals.set(employeeCode, monthTotal + cappedOvertime);
        employeeYearTotals.set(employeeCode, yearTotal + cappedOvertime);
        if (reasons.length > 0) adjustedRows++;

        auditRows.push({
          sourceAttendanceRecordId: source.id,
          employeeId: source.employee_id,
          employeeCode,
          employeeName: source.employee_name,
          workDate: source.work_date,
          weekdayName: source.weekday_name,
          departmentName: source.department_name,
          positionTitle: source.position_title,
          shiftName: source.shift_name,
          checkIn1: source.check_in_1,
          checkOut1: source.check_out_1,
          checkIn2: source.check_in_2,
          checkOut2: source.check_out_2,
          checkIn3: source.check_in_3,
          checkOut3: source.check_out_3,
          originalWorkdayCount: source.workday_count,
          originalWorkHours: source.work_hours,
          originalOvertimeNormalHours: source.overtime_normal_hours,
          originalOvertimeSundayHours: source.overtime_sunday_hours,
          originalOvertimeHolidayHours: source.overtime_holiday_hours,
          workdayCount: audited.workdayCount,
          workHours: audited.workHours,
          overtimeNormalHours: cappedOvertime,
          overtimeSundayHours: audited.overtimeSundayHours,
          overtimeHolidayHours: audited.overtimeHolidayHours,
          lateMinutes: source.late_minutes,
          earlyLeaveMinutes: source.early_leave_minutes,
          symbol: source.symbol,
          extraSymbol: source.extra_symbol,
          totalHours: source.total_hours,
          adjustmentReason: reasons,
          note: reasons.join(" "),
        });
      }

      if (auditRows.length > 0) {
        await client.query(
          `INSERT INTO audit_attendance_records (
             payroll_cycle_id, source_attendance_record_id, audit_config_id, employee_id, employee_code, employee_name,
             work_date, weekday_name, department_name, position_title, shift_name, check_in_1, check_out_1,
             check_in_2, check_out_2, check_in_3, check_out_3, original_workday_count, original_work_hours,
             original_overtime_normal_hours, original_overtime_sunday_hours, original_overtime_holiday_hours,
             workday_count, work_hours, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
             late_minutes, early_leave_minutes, symbol, extra_symbol, total_hours, adjustment_reason, note
           )
           SELECT
             $1, "sourceAttendanceRecordId", $2, "employeeId", "employeeCode", "employeeName",
             "workDate", "weekdayName", "departmentName", "positionTitle", "shiftName", "checkIn1", "checkOut1",
             "checkIn2", "checkOut2", "checkIn3", "checkOut3", "originalWorkdayCount", "originalWorkHours",
             "originalOvertimeNormalHours", "originalOvertimeSundayHours", "originalOvertimeHolidayHours",
             "workdayCount", "workHours", "overtimeNormalHours", "overtimeSundayHours", "overtimeHolidayHours",
             "lateMinutes", "earlyLeaveMinutes", symbol, "extraSymbol", "totalHours", "adjustmentReason", note
           FROM jsonb_to_recordset($3::jsonb) AS audit_data(
             "sourceAttendanceRecordId" uuid,
             "employeeId" uuid,
             "employeeCode" text,
             "employeeName" text,
             "workDate" date,
             "weekdayName" text,
             "departmentName" text,
             "positionTitle" text,
             "shiftName" text,
             "checkIn1" time,
             "checkOut1" time,
             "checkIn2" time,
             "checkOut2" time,
             "checkIn3" time,
             "checkOut3" time,
             "originalWorkdayCount" numeric,
             "originalWorkHours" numeric,
             "originalOvertimeNormalHours" numeric,
             "originalOvertimeSundayHours" numeric,
             "originalOvertimeHolidayHours" numeric,
             "workdayCount" numeric,
             "workHours" numeric,
             "overtimeNormalHours" numeric,
             "overtimeSundayHours" numeric,
             "overtimeHolidayHours" numeric,
             "lateMinutes" integer,
             "earlyLeaveMinutes" integer,
             symbol text,
             "extraSymbol" text,
             "totalHours" numeric,
             "adjustmentReason" jsonb,
             note text
           )`,
          [cycleId, config.id, JSON.stringify(auditRows)]
        );
      }

      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, payload)
         VALUES ($1, $2, 'generate_audit_attendance', $3)`,
        [
          cycleId,
          actorId,
          JSON.stringify({ totalRows: sourceRes.rows.length, adjustedRows, configCode: config.code }),
        ]
      );

      return { totalRows: sourceRes.rows.length, adjustedRows };
    });
  }

  static async calculateAuditPayroll(cycleId: string, actorId: string, factoryId: string) {
    const config = await this.getActiveConfig();

    return await transaction(async (client) => {
      const cycleRes = await client.query(
        `SELECT id, factory_id, code, period_start, period_end, standard_workdays, standard_hours_per_day, status
         FROM payroll_cycles
         WHERE id = $1 AND factory_id = $2`,
        [cycleId, factoryId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");

      const cycle = cycleRes.rows[0];
      const auditCount = await client.query(
        `SELECT COUNT(*)::int as count FROM audit_attendance_records WHERE payroll_cycle_id = $1`,
        [cycleId]
      );
      if (auditCount.rows[0].count === 0) {
        throw new Error("Chưa có bảng chấm công audit. Hãy chạy audit trước khi tính lương audit.");
      }

      const rules = await PayrollRuleService.getRulesMap();
      const stdWorkdays = toNumber(cycle.standard_workdays);
      const stdHoursPerDay = toNumber(cycle.standard_hours_per_day);
      const otNormalRate = rules["overtime_normal_rate"] || 1.5;
      const otSundayRate = rules["overtime_sunday_rate"] || 2;
      const otHolidayRate = rules["overtime_holiday_rate"] || 3;
      const empInsRate = rules["employee_insurance_rate"] || 0.105;
      const empUnionRate = rules["employee_union_rate"] || 0.01;
      const ctyBHXH = rules["company_social_insurance_rate"] || 0.175;
      const ctyBHYT = rules["company_health_insurance_rate"] || 0.03;
      const ctyBHTN = rules["company_unemployment_insurance_rate"] || 0.01;
      const ctyUnion = rules["company_union_rate"] || 0.02;

      const employeesRes = await client.query(
        `SELECT id, employee_code, full_name, gender, dependent_count, has_child_under_6
         FROM employees
         WHERE deleted_at IS NULL AND status = 'active' AND factory_id = $1
         ORDER BY employee_code ASC`,
        [cycle.factory_id]
      );
      const employeeIds = employeesRes.rows.map((employee: any) => employee.id);

      await client.query(`DELETE FROM audit_payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
      const periodStartStr = new Date(cycle.period_start).toISOString().split("T")[0];
      const periodEndStr = new Date(cycle.period_end).toISOString().split("T")[0];
      const salaryConfigsRes = employeeIds.length > 0
        ? await client.query(
            `SELECT DISTINCT ON (employee_id)
                    id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo",
                    total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary",
                    position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance",
                    seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance",
                    phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance",
                    housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus",
                    other_bonus as "otherBonus", meal_allowance as "mealAllowance", note
             FROM employee_salary_configs
             WHERE employee_id = ANY($1::uuid[])
               AND effective_from <= $2::date
               AND (effective_to IS NULL OR effective_to >= $3::date)
             ORDER BY employee_id, effective_from DESC`,
            [employeeIds, periodEndStr, periodStartStr]
          )
        : { rows: [] };
      const salaryConfigByEmployeeId = new Map<string, any>(
        salaryConfigsRes.rows.map((salaryConfig: any) => [salaryConfig.employeeId, salaryConfig])
      );

      const attendanceTotalsRes = employeeIds.length > 0
        ? await client.query(
            `SELECT employee_id as "employeeId",
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('PN', 'P') THEN 1 ELSE 0 END), 0) as "paidLeaveDays",
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('L', 'LE') THEN 1 ELSE 0 END), 0) as "holidayDays",
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('RO', 'KP') THEN 1 ELSE 0 END), 0) as "unpaidLeaveDays",
                    COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(symbol, ''))) NOT IN ('PN', 'P', 'L', 'LE', 'RO', 'KP') THEN workday_count ELSE 0 END), 0) as "actualWorkdays",
                    COALESCE(SUM(overtime_normal_hours), 0) as "overtimeNormalHours",
                    COALESCE(SUM(overtime_sunday_hours), 0) as "overtimeSundayHours",
                    COALESCE(SUM(overtime_holiday_hours), 0) as "overtimeHolidayHours"
             FROM audit_attendance_records
             WHERE payroll_cycle_id = $1 AND employee_id = ANY($2::uuid[])
             GROUP BY employee_id`,
            [cycleId, employeeIds]
          )
        : { rows: [] };
      const attendanceTotalsByEmployeeId = new Map<string, any>(
        attendanceTotalsRes.rows.map((attendance: any) => [attendance.employeeId, attendance])
      );
      const auditPayrollRows: any[] = [];
      const auditPayrollLinesByEmployeeId = new Map<string, any[]>();

      let calculatedRows = 0;
      for (const emp of employeesRes.rows) {
        const salaryConfig = salaryConfigByEmployeeId.get(emp.id);
        if (!salaryConfig) continue;

        const attendanceTotals = attendanceTotalsByEmployeeId.get(emp.id);
        if (!attendanceTotals) continue;

        const actualWorkdays = toNumber(attendanceTotals.actualWorkdays);
        const paidLeaveDays = toNumber(attendanceTotals.paidLeaveDays);
        const holidayDays = toNumber(attendanceTotals.holidayDays);
        const unpaidLeaveDays = toNumber(attendanceTotals.unpaidLeaveDays);
        const overtimeNormalHours = toNumber(attendanceTotals.overtimeNormalHours);
        const overtimeSundayHours = toNumber(attendanceTotals.overtimeSundayHours);
        const overtimeHolidayHours = toNumber(attendanceTotals.overtimeHolidayHours);

        const totalSalary = toNumber(salaryConfig.totalSalary);
        const insuranceSalary = toNumber(salaryConfig.insuranceSalary);
        const baseSalary = toNumber(salaryConfig.baseSalary);
        const dailyRate = totalSalary / stdWorkdays;
        const otBase = baseSalary > 0 ? baseSalary : insuranceSalary > 0 ? insuranceSalary : totalSalary;
        const hourlyBase = otBase / stdWorkdays / stdHoursPerDay;
        const leaveBase = insuranceSalary > 0 ? insuranceSalary : baseSalary > 0 ? baseSalary : totalSalary;
        const dailyLeaveRate = leaveBase / stdWorkdays;

        const monthlySalaryAmount = Math.round(dailyRate * actualWorkdays);
        const paidLeaveAmount = Math.round(dailyLeaveRate * (paidLeaveDays + holidayDays));
        const overtimeNormalAmount = Math.round(overtimeNormalHours * hourlyBase * otNormalRate);
        const overtimeSundayAmount = Math.round(overtimeSundayHours * hourlyBase * otSundayRate);
        const overtimeHolidayAmount = Math.round(overtimeHolidayHours * hourlyBase * otHolidayRate);

        const seniorityAllowance = toNumber(salaryConfig.seniorityAllowance);
        let menstrualAllowance = 0;
        const isFemale = emp.gender === "Nữ" || emp.gender === "Female";
        if (isFemale && (actualWorkdays > 0 || paidLeaveDays > 0)) {
          menstrualAllowance = Math.round((leaveBase / stdWorkdays / stdHoursPerDay) * 1.5);
        }

        const childAllowance = emp.has_child_under_6 ? 100000 * (emp.dependent_count > 0 ? emp.dependent_count : 1) : 0;
        const flatAllowanceAmount = seniorityAllowance + menstrualAllowance + childAllowance;
        const grossIncome = monthlySalaryAmount + paidLeaveAmount + overtimeNormalAmount + overtimeSundayAmount + overtimeHolidayAmount + flatAllowanceAmount;
        const employeeInsuranceAmount = Math.round(insuranceSalary * empInsRate);
        const unionFeeAmount = Math.round(Math.min(baseSalary * empUnionRate, 30000));
        const companyInsuranceAmount = Math.round(insuranceSalary * (ctyBHXH + ctyBHYT + ctyBHTN + ctyUnion));
        const personalDeduction = 11000000;
        const dependentDeduction = 4400000 * (emp.dependent_count || 0);
        const taxableIncome = Math.max(0, grossIncome - employeeInsuranceAmount - unionFeeAmount - personalDeduction - dependentDeduction);

        let pitAmount = 0;
        if (taxableIncome > 0) {
          if (taxableIncome <= 5000000) pitAmount = taxableIncome * 0.05;
          else if (taxableIncome <= 10000000) pitAmount = taxableIncome * 0.1 - 250000;
          else if (taxableIncome <= 18000000) pitAmount = taxableIncome * 0.15 - 750000;
          else if (taxableIncome <= 32000000) pitAmount = taxableIncome * 0.2 - 1650000;
          else if (taxableIncome <= 52000000) pitAmount = taxableIncome * 0.25 - 3250000;
          else if (taxableIncome <= 80000000) pitAmount = taxableIncome * 0.3 - 5850000;
          else pitAmount = taxableIncome * 0.35 - 9850000;
          pitAmount = Math.round(pitAmount);
        }

        const totalDeduction = employeeInsuranceAmount + unionFeeAmount + pitAmount;
        const netSalary = grossIncome - totalDeduction;
        const secondPaymentAmount = Math.round(netSalary / 1000) * 1000;

        auditPayrollRows.push({
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          employeeName: emp.full_name,
          salaryConfigSnapshot: salaryConfig,
          ruleSnapshot: rules,
          auditConfigSnapshot: config,
          actualWorkdays,
          paidLeaveDays,
          holidayDays,
          unpaidLeaveDays,
          overtimeNormalHours,
          overtimeSundayHours,
          overtimeHolidayHours,
          monthlySalaryAmount,
          paidLeaveAmount,
          overtimeNormalAmount,
          overtimeSundayAmount,
          overtimeHolidayAmount,
          allowanceAmount: flatAllowanceAmount,
          grossIncome,
          companyInsuranceAmount,
          employeeInsuranceAmount,
          unionFeeAmount,
          personalIncomeTaxAmount: pitAmount,
          advancePayment1: 0,
          advancePayment2: 0,
          totalDeduction,
          netSalary,
          secondPaymentAmount,
          note: `Tính lương audit cho chu kỳ ${cycle.code}.`,
        });

        const lines = [
          { code: "audit_luong_ngay_cong", name: `Audit lương ngày công (${actualWorkdays} ngày)`, qty: actualWorkdays, rate: dailyRate, amount: monthlySalaryAmount, type: "earning", order: 10 },
          { code: "audit_luong_phep_le", name: `Audit lương phép, lễ (${paidLeaveDays + holidayDays} ngày)`, qty: paidLeaveDays + holidayDays, rate: dailyLeaveRate, amount: paidLeaveAmount, type: "earning", order: 20 },
          { code: "audit_tang_ca_1", name: `Audit tăng ca 1 (${overtimeNormalHours}h)`, qty: overtimeNormalHours, rate: hourlyBase * otNormalRate, amount: overtimeNormalAmount, type: "earning", order: 30 },
          { code: "audit_khau_tru_bhxh", name: "BHXH khấu trừ", qty: empInsRate, rate: insuranceSalary, amount: employeeInsuranceAmount, type: "deduction", order: 100 },
        ];

        auditPayrollLinesByEmployeeId.set(emp.id, lines);
        calculatedRows++;
      }

      if (auditPayrollRows.length > 0) {
        const insertedItems = await client.query(
          `INSERT INTO audit_payroll_items (
             payroll_cycle_id, employee_id, employee_code, employee_name, salary_config_snapshot, rule_snapshot,
             audit_config_snapshot, actual_workdays, paid_leave_days, holiday_days, unpaid_leave_days,
             overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, monthly_salary_amount,
             paid_leave_amount, overtime_normal_amount, overtime_sunday_amount, overtime_holiday_amount,
             allowance_amount, gross_income, company_insurance_amount, employee_insurance_amount, union_fee_amount,
             personal_income_tax_amount, advance_payment_1, advance_payment_2, total_deduction, net_salary,
             second_payment_amount, note
           )
           SELECT
             $1, "employeeId", "employeeCode", "employeeName", "salaryConfigSnapshot", "ruleSnapshot",
             "auditConfigSnapshot", "actualWorkdays", "paidLeaveDays", "holidayDays", "unpaidLeaveDays",
             "overtimeNormalHours", "overtimeSundayHours", "overtimeHolidayHours", "monthlySalaryAmount",
             "paidLeaveAmount", "overtimeNormalAmount", "overtimeSundayAmount", "overtimeHolidayAmount",
             "allowanceAmount", "grossIncome", "companyInsuranceAmount", "employeeInsuranceAmount", "unionFeeAmount",
             "personalIncomeTaxAmount", "advancePayment1", "advancePayment2", "totalDeduction", "netSalary",
             "secondPaymentAmount", note
           FROM jsonb_to_recordset($2::jsonb) AS payroll_data(
             "employeeId" uuid,
             "employeeCode" text,
             "employeeName" text,
             "salaryConfigSnapshot" jsonb,
             "ruleSnapshot" jsonb,
             "auditConfigSnapshot" jsonb,
             "actualWorkdays" numeric,
             "paidLeaveDays" numeric,
             "holidayDays" numeric,
             "unpaidLeaveDays" numeric,
             "overtimeNormalHours" numeric,
             "overtimeSundayHours" numeric,
             "overtimeHolidayHours" numeric,
             "monthlySalaryAmount" numeric,
             "paidLeaveAmount" numeric,
             "overtimeNormalAmount" numeric,
             "overtimeSundayAmount" numeric,
             "overtimeHolidayAmount" numeric,
             "allowanceAmount" numeric,
             "grossIncome" numeric,
             "companyInsuranceAmount" numeric,
             "employeeInsuranceAmount" numeric,
             "unionFeeAmount" numeric,
             "personalIncomeTaxAmount" numeric,
             "advancePayment1" numeric,
             "advancePayment2" numeric,
             "totalDeduction" numeric,
             "netSalary" numeric,
             "secondPaymentAmount" numeric,
             note text
           )
           RETURNING id, employee_id as "employeeId"`,
          [cycleId, JSON.stringify(auditPayrollRows)]
        );

        const lineRows = insertedItems.rows.flatMap((item: any) => {
          const lines = auditPayrollLinesByEmployeeId.get(item.employeeId) || [];
          return lines.map((line) => ({
            auditPayrollItemId: item.id,
            lineCode: line.code,
            lineName: line.name,
            quantity: line.qty,
            rate: line.rate,
            amount: line.amount,
            lineType: line.type,
            sortOrder: line.order,
          }));
        });

        if (lineRows.length > 0) {
          await client.query(
            `INSERT INTO audit_payroll_item_lines (audit_payroll_item_id, line_code, line_name, quantity, rate, amount, line_type, sort_order)
             SELECT "auditPayrollItemId", "lineCode", "lineName", quantity, rate, amount, "lineType", "sortOrder"
             FROM jsonb_to_recordset($1::jsonb) AS line_data(
               "auditPayrollItemId" uuid,
               "lineCode" text,
               "lineName" text,
               quantity numeric,
               rate numeric,
               amount numeric,
               "lineType" text,
               "sortOrder" integer
             )`,
            [JSON.stringify(lineRows)]
          );
        }
      }

      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, payload)
         VALUES ($1, $2, 'calculate_audit_payroll', $3)`,
        [cycleId, actorId, JSON.stringify({ calculatedRows, configCode: config.code })]
      );

      return { calculatedRows };
    });
  }

  static async getAuditAttendanceRecords(cycleId: string, factoryId: string, search?: string) {
    let sql = `SELECT id, employee_code as "employeeCode", employee_name as "employeeName", work_date as "workDate",
                      weekday_name as "weekdayName", department_name as "departmentName", position_title as "positionTitle",
                      shift_name as "shiftName", check_in_1 as "checkIn1", check_out_1 as "checkOut1",
                      original_workday_count as "originalWorkdayCount", original_work_hours as "originalWorkHours",
                      original_overtime_normal_hours as "originalOvertimeNormalHours",
                      original_overtime_sunday_hours as "originalOvertimeSundayHours",
                      workday_count as "workdayCount", work_hours as "workHours",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", late_minutes as "lateMinutes",
                      early_leave_minutes as "earlyLeaveMinutes", symbol, total_hours as "totalHours",
                      adjustment_reason as "adjustmentReason", note
               FROM audit_attendance_records
               WHERE payroll_cycle_id = $1
                 AND EXISTS (
                   SELECT 1 FROM payroll_cycles c
                   WHERE c.id = audit_attendance_records.payroll_cycle_id
                     AND c.factory_id = $2
                 )`;
    const params: string[] = [cycleId, factoryId];

    if (search) {
      sql += ` AND (employee_code ILIKE $3 OR employee_name ILIKE $3 OR department_name ILIKE $3)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC, work_date ASC`;
    return await query(sql, params);
  }

  static async getAuditPayrollItems(cycleId: string, factoryId: string, search?: string) {
    let sql = `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
                      employee_code as "employeeCode", employee_name as "employeeName",
                      actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
                      holiday_days as "holidayDays", unpaid_leave_days as "unpaidLeaveDays",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", monthly_salary_amount as "monthlySalaryAmount",
                      paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
                      overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
                      allowance_amount as "allowanceAmount", gross_income as "grossIncome",
                      company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
                      union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
                      total_deduction as "totalDeduction", net_salary as "netSalary",
                      second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
               FROM audit_payroll_items
               WHERE payroll_cycle_id = $1
                 AND EXISTS (
                   SELECT 1 FROM payroll_cycles c
                   WHERE c.id = audit_payroll_items.payroll_cycle_id
                     AND c.factory_id = $2
                 )`;
    const params: string[] = [cycleId, factoryId];

    if (search) {
      sql += ` AND (employee_code ILIKE $3 OR employee_name ILIKE $3)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;
    return await query(sql, params);
  }
}
