import { query } from '../db';
import { getAllEmployees } from './employee';
import { getTimekeepingSummary } from './timekeeping';

export interface PayrollRule {
  key: string;
  value: string;
  description: string;
}

// Fetch active rules from the default rule set
export async function getPayrollRules(): Promise<Record<string, string>> {
  const res = await query(`
    SELECT r.key, COALESCE(r.value_text, r.value_numeric::text) as value
    FROM payroll_rules r
    JOIN payroll_rule_sets rs ON r.rule_set_id = rs.id
    WHERE rs.is_default = true
  `);
  const rules: Record<string, string> = {};
  res.rows.forEach(row => {
    rules[row.key] = row.value;
  });
  return rules;
}

export async function updatePayrollRule(key: string, value: string, description?: string) {
  const defaultSetRes = await query("SELECT id FROM payroll_rule_sets WHERE is_default = true LIMIT 1");
  if (defaultSetRes.rows.length === 0) {
    throw new Error("Default rule set not found!");
  }
  const setId = defaultSetRes.rows[0].id;
  
  const isNumeric = !isNaN(Number(value)) && value.trim() !== '';
  let sql = 'UPDATE payroll_rules SET value_numeric = NULL, value_text = NULL, updated_at = CURRENT_TIMESTAMP';
  const params = [setId, key];
  
  if (isNumeric) {
    sql = 'UPDATE payroll_rules SET value_numeric = $3, value_text = NULL, updated_at = CURRENT_TIMESTAMP';
    params.push(Number(value));
  } else {
    sql = 'UPDATE payroll_rules SET value_numeric = NULL, value_text = $3, updated_at = CURRENT_TIMESTAMP';
    params.push(value);
  }
  
  if (description !== undefined) {
    sql += `, description = $${params.length + 1}`;
    params.push(description);
  }
  sql += ' WHERE rule_set_id = $1 AND key = $2 RETURNING *';
  const res = await query(sql, params);
  return res.rows[0];
}

export async function getPayrollRulesList(): Promise<any[]> {
  const res = await query(`
    SELECT r.id, r.key, COALESCE(r.value_text, r.value_numeric::text) as value, r.description
    FROM payroll_rules r
    JOIN payroll_rule_sets rs ON r.rule_set_id = rs.id
    WHERE rs.is_default = true
    ORDER BY r.key ASC
  `);
  return res.rows;
}

// Manage Cycles
export async function getPayrollCycles() {
  const res = await query('SELECT * FROM payroll_cycles ORDER BY id DESC');
  return res.rows;
}

export async function createPayrollCycle(id: string, name: string, startDate: string, endDate: string) {
  const defaultSetRes = await query("SELECT id FROM payroll_rule_sets WHERE is_default = true LIMIT 1");
  const defaultSetId = defaultSetRes.rows.length > 0 ? defaultSetRes.rows[0].id : null;

  const res = await query(
    `INSERT INTO payroll_cycles (id, name, start_date, end_date, rule_set_id, status) 
     VALUES ($1, $2, $3, $4, $5, 'draft') 
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date 
     RETURNING *`,
    [id, name, startDate, endDate, defaultSetId]
  );
  return res.rows[0];
}

export async function deletePayrollCycle(id: string) {
  const cycleRes = await query("SELECT status FROM payroll_cycles WHERE id = $1", [id]);
  if (cycleRes.rows.length > 0) {
    const status = cycleRes.rows[0].status;
    if (['locked', 'paid', 'cancelled'].includes(status)) {
      throw new Error(`Kỳ lương này đang ở trạng thái "${status}" và đã được khóa. Không thể xóa.`);
    }
  }
  const res = await query('DELETE FROM payroll_cycles WHERE id = $1 RETURNING *', [id]);
  return res.rows[0];
}

export async function finalizePayrollCycle(id: string) {
  const res = await query(`
    UPDATE payroll_cycles 
    SET status = 'locked', locked_at = CURRENT_TIMESTAMP 
    WHERE id = $1 RETURNING *
  `, [id]);
  return res.rows[0];
}

// Progressive Income Tax (Vietnam)
function calculatePIT(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  
  if (taxableIncome <= 5000000) {
    return taxableIncome * 0.05;
  } else if (taxableIncome <= 10000000) {
    return taxableIncome * 0.10 - 250000;
  } else if (taxableIncome <= 18000000) {
    return taxableIncome * 0.15 - 750000;
  } else if (taxableIncome <= 32000000) {
    return taxableIncome * 0.20 - 1650000;
  } else if (taxableIncome <= 52000000) {
    return taxableIncome * 0.25 - 3250000;
  } else if (taxableIncome <= 80000000) {
    return taxableIncome * 0.30 - 5850000;
  } else {
    return taxableIncome * 0.35 - 9850000;
  }
}

// Calculate and save payroll for a cycle
export async function calculatePayroll(cycleId: string) {
  // Load cycle details
  const cycleRes = await query("SELECT start_date, end_date, rule_set_id, status FROM payroll_cycles WHERE id = $1", [cycleId]);
  if (cycleRes.rows.length === 0) {
    throw new Error("Không tìm thấy chu kỳ tính lương.");
  }
  const { end_date, rule_set_id: ruleSetId, status } = cycleRes.rows[0];
  if (['locked', 'paid', 'cancelled'].includes(status)) {
    throw new Error(`Kỳ lương này đang ở trạng thái "${status}" và đã được khóa. Không thể chạy lại tính toán.`);
  }

  // Fetch employees and their historic configs active during that cycle
  const empRes = await query(`
    SELECT e.id, e.full_name, e.gender, e.department_name, e.position,
           c.total_salary, c.insurance_salary, c.basic_salary,
           c.allowance_title, c.allowance_responsibility, c.allowance_seniority, c.allowance_safety,
           c.allowance_phone, c.allowance_other, c.allowance_travel, c.allowance_housing,
           c.children_under_6_count, c.dependents_count, c.is_union_member
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT *
      FROM employee_salary_configs sc
      WHERE sc.employee_id = e.id
        AND sc.effective_from <= $1
      ORDER BY sc.effective_from DESC
      LIMIT 1
    ) c ON true
    WHERE e.deleted_at IS NULL
  `, [end_date]);
  const employees = empRes.rows;
  
  // Fetch timekeeping summaries
  const timekeepingSummaries = await getTimekeepingSummary(cycleId);
  const tkMap = new Map<string, any>();
  timekeepingSummaries.forEach(tk => {
    tkMap.set(tk.employee_id, tk);
  });

  // Load rules for this specific rule set
  const rulesRes = await query(`
    SELECT key, COALESCE(value_text, value_numeric::text) as value
    FROM payroll_rules
    WHERE rule_set_id = $1
  `, [ruleSetId]);
  
  const rules: Record<string, string> = {};
  rulesRes.rows.forEach(r => {
    rules[r.key] = r.value;
  });

  const stdDays = parseFloat(rules.working_days_standard || '26');
  const regOTMul = parseFloat(rules.regular_ot_multiplier || '1.5');
  const sunOTMul = parseFloat(rules.sunday_ot_multiplier || '2.0');
  const holOTMul = parseFloat(rules.holiday_ot_multiplier || '3.0');
  
  const insRate = parseFloat(rules.employee_insurance_rate || '0.105');
  const unionFee = parseFloat(rules.union_fee_flat || '30000');
  const femaleHours = parseFloat(rules.female_allowance_hours || '1.5');
  const childRate = parseFloat(rules.child_under_6_allowance || '100000');
  
  const selfTaxDeduction = parseFloat(rules.personal_tax_deduction || '11000000');
  const dependentTaxDeduction = parseFloat(rules.dependent_tax_deduction || '4400000');

  const results: any[] = [];

  await query('BEGIN');
  try {
    // Clear old payroll results
    await query('DELETE FROM payroll_results WHERE cycle_id = $1', [cycleId]);

    for (const emp of employees) {
      const tk = tkMap.get(emp.id) || {
        total_workdays: 0,
        leave_days: 0,
        holiday_days: 0,
        ot_hours_regular: 0,
        ot_hours_sunday: 0,
        ot_hours_holiday: 0
      };

      const totalWorkdays = Number(tk.total_workdays || 0);
      const leaveDays = Number(tk.leave_days || 0);
      const holidayDays = Number(tk.holiday_days || 0);
      const otHoursReg = Number(tk.ot_hours_regular || 0);
      const otHoursSun = Number(tk.ot_hours_sunday || 0);
      const otHoursHol = Number(tk.ot_hours_holiday || 0);

      // Fetch configurations
      const totalSalary = Number(emp.total_salary || 0);
      const insSalary = Number(emp.insurance_salary || 0);
      const isUnionMember = emp.is_union_member !== false; // default true
      
      const dailyRate = totalSalary / stdDays;
      const hourlyRate = insSalary / stdDays / 8;

      // Regular Workday Salary
      const salaryWorkdays = Math.round(dailyRate * totalWorkdays);
      
      // Paid Leave & Holiday Salary
      const salaryLeaveHoliday = Math.round((insSalary / stdDays) * (leaveDays + holidayDays));

      // Overtime Pay
      const otPayReg = Math.round(otHoursReg * regOTMul * hourlyRate);
      const otPaySun = Math.round(otHoursSun * sunOTMul * hourlyRate);
      const otPayHol = Math.round(otHoursHol * holOTMul * hourlyRate);

      // Allowances - sum up ALL allowances in employee salary configuration
      const allowanceTitle = Number(emp.allowance_title || 0);
      const allowanceResp = Number(emp.allowance_responsibility || 0);
      const allowanceSen = Number(emp.allowance_seniority || 0);
      const allowanceSafe = Number(emp.allowance_safety || 0);
      const allowancePhone = Number(emp.allowance_phone || 0);
      const allowanceOther = Number(emp.allowance_other || 0);
      const allowanceTravel = Number(emp.allowance_travel || 0);
      const allowanceHousing = Number(emp.allowance_housing || 0);
      
      const allowanceFemale = emp.gender === 'female' ? Math.round(hourlyRate * femaleHours) : 0;
      const allowanceChildren = Number(emp.children_under_6_count || 0) * childRate;

      const totalAllowances = allowanceTitle + allowanceResp + allowanceSen + allowanceSafe + allowancePhone +
                              allowanceOther + allowanceTravel + allowanceHousing + allowanceFemale + allowanceChildren;

      // Gross Income
      const grossIncome = salaryWorkdays + salaryLeaveHoliday + totalAllowances + otPayReg + otPaySun + otPayHol;

      // Deductions
      const deductionInsurance = Math.round(insSalary * insRate);
      const deductionUnion = (isUnionMember && insSalary > 0) ? unionFee : 0;

      // Taxable Income & PIT
      const dependentsCount = Number(emp.dependents_count || 0);
      const selfDeduction = selfTaxDeduction;
      const dependentDeduction = dependentsCount * dependentTaxDeduction;
      const taxableIncome = Math.max(0, grossIncome - deductionInsurance - deductionUnion - selfDeduction - dependentDeduction);
      const taxAmount = Math.round(calculatePIT(taxableIncome));

      // Net Salary
      const netSalary = grossIncome - deductionInsurance - deductionUnion - taxAmount;

      // Advance splits
      const advance2 = otPayReg + otPaySun + otPayHol; // Overtime paid in 2nd installment
      const advance1 = Math.max(0, netSalary - advance2); // Base salary in 1st installment
      const remainingSalary = netSalary;

      // Create snapshots
      const salaryConfigSnapshot = JSON.stringify({
        total_salary: totalSalary,
        insurance_salary: insSalary,
        basic_salary: Number(emp.basic_salary || 0),
        allowance_title: Number(emp.allowance_title || 0),
        allowance_responsibility: Number(emp.allowance_responsibility || 0),
        allowance_seniority: allowanceSen,
        allowance_safety: Number(emp.allowance_safety || 0),
        allowance_phone: Number(emp.allowance_phone || 0),
        allowance_other: Number(emp.allowance_other || 0),
        allowance_travel: Number(emp.allowance_travel || 0),
        allowance_housing: Number(emp.allowance_housing || 0),
        children_under_6_count: Number(emp.children_under_6_count || 0),
        dependents_count: dependentsCount,
        is_union_member: isUnionMember
      });

      const ruleSnapshot = JSON.stringify(rules);

      const sql = `
        INSERT INTO payroll_results (
          cycle_id, employee_id, salary_config_snapshot, rule_snapshot,
          total_workdays, leave_days, holiday_days,
          ot_hours_regular, ot_hours_sunday, ot_hours_holiday,
          salary_workdays, salary_leave_holiday, total_allowances,
          ot_pay_regular, ot_pay_sunday, ot_pay_holiday,
          gross_income, deduction_insurance, deduction_union,
          taxable_income, tax_amount, net_salary,
          advance_1, advance_2, remaining_salary, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'draft'
        )
      `;

      await query(sql, [
        cycleId, emp.id, salaryConfigSnapshot, ruleSnapshot,
        totalWorkdays, leaveDays, holidayDays,
        otHoursReg, otHoursSun, otHoursHol,
        salaryWorkdays, salaryLeaveHoliday, totalAllowances,
        otPayReg, otPaySun, otPayHol,
        grossIncome, deductionInsurance, deductionUnion,
        taxableIncome, taxAmount, netSalary,
        advance1, advance2, remainingSalary
      ]);

      results.push({
        employee_id: emp.id,
        employee_name: emp.full_name,
        net_salary: netSalary
      });
    }

    // Update cycle status to calculated
    await query("UPDATE payroll_cycles SET status = 'calculated', calculated_at = CURRENT_TIMESTAMP WHERE id = $1", [cycleId]);

    await query('COMMIT');
    return results;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function getPayrollCalculations(
  cycleId: string,
  page?: number,
  limit?: number,
  sortBy: string = 'employee_id',
  sortOrder: 'ASC' | 'DESC' = 'ASC',
  search?: string
): Promise<{ data: any[]; total: number }> {
  let sortField = 'p.employee_id';
  if (sortBy === 'employee_name') sortField = 'e.full_name';
  else if (sortBy === 'net_salary') sortField = 'p.net_salary';
  else if (sortBy === 'total_income' || sortBy === 'gross_income') sortField = 'p.gross_income';
  else if (sortBy === 'total_workdays') sortField = 'p.total_workdays';

  const sanitizedOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let sql = `
    FROM payroll_results p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.cycle_id = $1 AND e.deleted_at IS NULL
  `;
  const params: any[] = [cycleId];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (e.full_name ILIKE $${params.length} OR p.employee_id ILIKE $${params.length})`;
  }

  const countRes = await query(`SELECT COUNT(*) as count ${sql}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  let querySql = `
    SELECT p.id, p.cycle_id, p.employee_id, e.full_name as employee_name, e.department_name as department, e.position,
           p.total_workdays, p.leave_days, p.holiday_days,
           p.ot_hours_regular, p.ot_hours_sunday, p.ot_hours_holiday,
           p.salary_workdays, p.salary_leave_holiday, p.total_allowances,
           p.ot_pay_regular, p.ot_pay_sunday, p.ot_pay_holiday,
           p.gross_income as total_income, 
           p.deduction_insurance as deduction_social_insurance, 
           p.deduction_union,
           p.taxable_income, p.tax_amount, p.net_salary,
           p.advance_1, p.advance_2, p.remaining_salary, p.status,
           (p.salary_config_snapshot->>'total_salary')::numeric as emp_total_salary,
           (p.salary_config_snapshot->>'insurance_salary')::numeric as emp_insurance_salary
    ${sql}
    ORDER BY ${sortField} ${sanitizedOrder}
  `;

  if (page !== undefined && limit !== undefined) {
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    querySql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const res = await query(querySql, params);
  return { data: res.rows, total };
}

export async function getPayrollCalculationDetails(cycleId: string, employeeId: string) {
  const sql = `
    SELECT p.*, e.full_name as employee_name, e.department_name as department, e.position, e.gender
    FROM payroll_results p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.cycle_id = $1 AND p.employee_id = $2 AND e.deleted_at IS NULL
  `;
  const res = await query(sql, [cycleId, employeeId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  const config = typeof row.salary_config_snapshot === 'string' ? JSON.parse(row.salary_config_snapshot) : row.salary_config_snapshot;
  const rules = typeof row.rule_snapshot === 'string' ? JSON.parse(row.rule_snapshot) : row.rule_snapshot;

  const stdDays = parseFloat(rules.working_days_standard || '26');
  const insSalary = parseFloat(config.insurance_salary || '0');
  const hourlyRate = insSalary / stdDays / 8;
  const femaleHours = parseFloat(rules.female_allowance_hours || '1.5');
  const childRate = parseFloat(rules.child_under_6_allowance || '100000');

  const allowanceFemale = row.gender === 'female' ? Math.round(hourlyRate * femaleHours) : 0;
  const allowanceChildren = parseInt(config.children_under_6_count || '0', 10) * childRate;

  return {
    id: row.id,
    cycle_id: row.cycle_id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    department: row.department,
    position: row.position,
    total_workdays: row.total_workdays,
    leave_days: row.leave_days,
    holiday_days: row.holiday_days,
    ot_hours_regular: row.ot_hours_regular,
    ot_hours_sunday: row.ot_hours_sunday,
    ot_hours_holiday: row.ot_hours_holiday,
    salary_workdays: row.salary_workdays,
    salary_leave_holiday: row.salary_leave_holiday,
    total_allowances: row.total_allowances,
    ot_pay_regular: row.ot_pay_regular,
    ot_pay_sunday: row.ot_pay_sunday,
    ot_pay_holiday: row.ot_pay_holiday,
    total_income: row.gross_income,
    deduction_social_insurance: row.deduction_insurance,
    deduction_union: row.deduction_union,
    taxable_income: row.taxable_income,
    tax_amount: row.tax_amount,
    net_salary: row.net_salary,
    advance_1: row.advance_1,
    advance_2: row.advance_2,
    remaining_salary: row.remaining_salary,
    status: row.status,
    gender: row.gender,
    emp_total_salary: config.total_salary,
    emp_insurance_salary: insSalary,
    emp_basic_salary: config.basic_salary,
    allowance_title: config.allowance_title,
    allowance_responsibility: config.allowance_responsibility,
    allowance_seniority: config.allowance_seniority,
    allowance_safety: config.allowance_safety,
    allowance_phone: config.allowance_phone,
    allowance_other: config.allowance_other,
    allowance_travel: config.allowance_travel,
    allowance_housing: config.allowance_housing,
    children_under_6_count: config.children_under_6_count,
    dependents_count: config.dependents_count,
    is_union_member: config.is_union_member,
    allowance_female: allowanceFemale,
    allowance_children: allowanceChildren
  };
}
