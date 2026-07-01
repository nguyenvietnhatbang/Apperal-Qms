import { query } from '../db';

export interface EmployeeData {
  id: string; // Mã nhân viên
  full_name: string;
  gender: 'male' | 'female' | 'other';
  department_name: string;
  position: string;
  join_date: string | null;
  status: 'active' | 'inactive';
  
  // Salary config fields
  total_salary: number;
  insurance_salary: number;
  basic_salary: number;
  allowance_title: number;
  allowance_responsibility: number;
  allowance_seniority: number;
  allowance_safety: number;
  allowance_phone: number;
  allowance_other: number;
  allowance_travel: number;
  allowance_housing: number;
  children_under_6_count: number;
  dependents_count: number;
  is_union_member: boolean;
}

export async function getAllEmployees(
  search?: string, 
  department?: string,
  page?: number,
  limit?: number,
  sortBy: string = 'id',
  sortOrder: 'ASC' | 'DESC' = 'ASC'
): Promise<{ data: any[]; total: number }> {
  let dbSortBy = 'e.id';
  if (sortBy === 'name' || sortBy === 'full_name') dbSortBy = 'e.full_name';
  else if (sortBy === 'department' || sortBy === 'department_name') dbSortBy = 'e.department_name';
  else if (sortBy === 'position') dbSortBy = 'e.position';
  else if (sortBy === 'join_date') dbSortBy = 'e.join_date';
  else if (sortBy === 'total_salary') dbSortBy = 'c.total_salary';
  else if (sortBy === 'insurance_salary') dbSortBy = 'c.insurance_salary';
  else if (sortBy === 'basic_salary') dbSortBy = 'c.basic_salary';

  const sanitizedOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let sql = 'FROM employees e LEFT JOIN LATERAL (SELECT * FROM employee_salary_configs sc WHERE sc.employee_id = e.id ORDER BY sc.effective_from DESC LIMIT 1) c ON true WHERE e.deleted_at IS NULL';
  const params: any[] = [];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (e.full_name ILIKE $${params.length} OR e.id ILIKE $${params.length} OR e.department_name ILIKE $${params.length})`;
  }

  if (department) {
    params.push(department);
    sql += ` AND e.department_name = $${params.length}`;
  }

  const countRes = await query(`SELECT COUNT(*) as count ${sql}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  let querySql = `
    SELECT e.id, e.full_name, e.gender, e.department_name, e.position, e.join_date, e.status,
           COALESCE(c.total_salary, 0) as total_salary,
           COALESCE(c.insurance_salary, 0) as insurance_salary,
           COALESCE(c.basic_salary, 0) as basic_salary,
           COALESCE(c.allowance_title, 0) as allowance_title,
           COALESCE(c.allowance_responsibility, 0) as allowance_responsibility,
           COALESCE(c.allowance_seniority, 0) as allowance_seniority,
           COALESCE(c.allowance_safety, 0) as allowance_safety,
           COALESCE(c.allowance_phone, 0) as allowance_phone,
           COALESCE(c.allowance_other, 0) as allowance_other,
           COALESCE(c.allowance_travel, 0) as allowance_travel,
           COALESCE(c.allowance_housing, 0) as allowance_housing,
           COALESCE(c.children_under_6_count, 0) as children_under_6_count,
           COALESCE(c.dependents_count, 0) as dependents_count,
           COALESCE(c.is_union_member, true) as is_union_member
    ${sql} 
    ORDER BY ${dbSortBy} ${sanitizedOrder}
  `;

  if (page !== undefined && limit !== undefined) {
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    querySql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const res = await query(querySql, params);
  return { data: res.rows, total };
}

export async function getEmployeeById(id: string) {
  const sql = `
    SELECT e.id, e.full_name, e.gender, e.department_name, e.position, e.join_date, e.status,
           COALESCE(c.total_salary, 0) as total_salary,
           COALESCE(c.insurance_salary, 0) as insurance_salary,
           COALESCE(c.basic_salary, 0) as basic_salary,
           COALESCE(c.allowance_title, 0) as allowance_title,
           COALESCE(c.allowance_responsibility, 0) as allowance_responsibility,
           COALESCE(c.allowance_seniority, 0) as allowance_seniority,
           COALESCE(c.allowance_safety, 0) as allowance_safety,
           COALESCE(c.allowance_phone, 0) as allowance_phone,
           COALESCE(c.allowance_other, 0) as allowance_other,
           COALESCE(c.allowance_travel, 0) as allowance_travel,
           COALESCE(c.allowance_housing, 0) as allowance_housing,
           COALESCE(c.children_under_6_count, 0) as children_under_6_count,
           COALESCE(c.dependents_count, 0) as dependents_count,
           COALESCE(c.is_union_member, true) as is_union_member
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT *
      FROM employee_salary_configs sc
      WHERE sc.employee_id = e.id
      ORDER BY sc.effective_from DESC
      LIMIT 1
    ) c ON true
    WHERE e.id = $1 AND e.deleted_at IS NULL
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

export async function createEmployee(data: any) {
  await query('BEGIN');
  try {
    const empSql = `
      INSERT INTO employees (id, full_name, gender, department_name, position, join_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const empParams = [
      data.id, 
      data.full_name || data.name || 'Chưa rõ', 
      data.gender === 'Nam' || data.gender === 'male' || data.is_female === false ? 'male' : 'female',
      data.department_name || data.department || 'Nhân viên',
      data.position || 'Nhân viên',
      data.join_date || null,
      data.status || 'active'
    ];
    await query(empSql, empParams);

    const configSql = `
      INSERT INTO employee_salary_configs (
        employee_id, effective_from, total_salary, insurance_salary, basic_salary,
        allowance_title, allowance_responsibility, allowance_seniority, allowance_safety,
        allowance_phone, allowance_other, allowance_travel, allowance_housing,
        children_under_6_count, dependents_count, is_union_member
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `;
    
    const effectiveFrom = data.join_date || new Date().toISOString().substring(0, 10);
    const configParams = [
      data.id,
      effectiveFrom,
      data.total_salary || 0,
      data.insurance_salary || 0,
      data.basic_salary || 0,
      data.allowance_title || 0,
      data.allowance_responsibility || 0,
      data.allowance_seniority || 0,
      data.allowance_safety || 0,
      data.allowance_phone || 0,
      data.allowance_other || 0,
      data.allowance_travel || 0,
      data.allowance_housing || 0,
      data.children_under_6_count !== undefined ? data.children_under_6_count : (data.children_count || 0),
      data.dependents_count || 0,
      data.is_union_member !== undefined ? data.is_union_member : true
    ];
    await query(configSql, configParams);
    
    await query('COMMIT');
    return getEmployeeById(data.id);
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

export async function updateEmployee(id: string, data: any) {
  await query('BEGIN');
  try {
    // 1. Update employees profile
    const empFields: string[] = [];
    const empParams: any[] = [];
    let empIdx = 1;

    if (data.full_name !== undefined || data.name !== undefined) {
      empFields.push(`full_name = $${empIdx++}`);
      empParams.push(data.full_name || data.name);
    }
    if (data.gender !== undefined) {
      empFields.push(`gender = $${empIdx++}`);
      empParams.push(data.gender === 'Nam' || data.gender === 'male' ? 'male' : 'female');
    }
    if (data.department_name !== undefined || data.department !== undefined) {
      empFields.push(`department_name = $${empIdx++}`);
      empParams.push(data.department_name || data.department);
    }
    if (data.position !== undefined) {
      empFields.push(`position = $${empIdx++}`);
      empParams.push(data.position);
    }
    if (data.join_date !== undefined) {
      empFields.push(`join_date = $${empIdx++}`);
      empParams.push(data.join_date);
    }
    if (data.status !== undefined) {
      empFields.push(`status = $${empIdx++}`);
      empParams.push(data.status);
    }

    if (empFields.length > 0) {
      empParams.push(id);
      const empSql = `UPDATE employees SET ${empFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${empIdx}`;
      await query(empSql, empParams);
    }

    // 2. Update employee_salary_configs (latest record)
    const configRes = await query('SELECT id FROM employee_salary_configs WHERE employee_id = $1 ORDER BY effective_from DESC LIMIT 1', [id]);
    if (configRes.rows.length > 0) {
      const configId = configRes.rows[0].id;
      const cfgFields: string[] = [];
      const cfgParams: any[] = [];
      let cfgIdx = 1;

      const salaryFields = [
        'total_salary', 'insurance_salary', 'basic_salary',
        'allowance_title', 'allowance_responsibility', 'allowance_seniority',
        'allowance_safety', 'allowance_phone', 'allowance_other',
        'allowance_travel', 'allowance_housing', 'dependents_count', 'is_union_member'
      ];

      for (const field of salaryFields) {
        if (data[field] !== undefined) {
          cfgFields.push(`${field} = $${cfgIdx++}`);
          cfgParams.push(data[field]);
        }
      }

      if (data.children_under_6_count !== undefined || data.children_count !== undefined) {
        cfgFields.push(`children_under_6_count = $${cfgIdx++}`);
        cfgParams.push(data.children_under_6_count !== undefined ? data.children_under_6_count : data.children_count);
      }

      if (cfgFields.length > 0) {
        cfgParams.push(configId);
        const cfgSql = `UPDATE employee_salary_configs SET ${cfgFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${cfgIdx}`;
        await query(cfgSql, cfgParams);
      }
    } else {
      // Create one if it does not exist
      const configSql = `
        INSERT INTO employee_salary_configs (
          employee_id, effective_from, total_salary, insurance_salary, basic_salary,
          allowance_title, allowance_responsibility, allowance_seniority, allowance_safety,
          allowance_phone, allowance_other, allowance_travel, allowance_housing,
          children_under_6_count, dependents_count, is_union_member
        ) VALUES (
          $1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `;
      await query(configSql, [
        id,
        data.total_salary || 0,
        data.insurance_salary || 0,
        data.basic_salary || 0,
        data.allowance_title || 0,
        data.allowance_responsibility || 0,
        data.allowance_seniority || 0,
        data.allowance_safety || 0,
        data.allowance_phone || 0,
        data.allowance_other || 0,
        data.allowance_travel || 0,
        data.allowance_housing || 0,
        data.children_under_6_count !== undefined ? data.children_under_6_count : (data.children_count || 0),
        data.dependents_count || 0,
        data.is_union_member !== undefined ? data.is_union_member : true
      ]);
    }

    await query('COMMIT');
    return getEmployeeById(id);
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

export async function deleteEmployee(id: string) {
  const res = await query('UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] || null;
}

export async function getUniqueDepartments() {
  const res = await query('SELECT DISTINCT department_name FROM employees WHERE deleted_at IS NULL ORDER BY department_name ASC');
  return res.rows.map(r => r.department_name);
}
