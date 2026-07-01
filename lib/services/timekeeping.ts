import { query } from '../db';
import { getEmployeeById, createEmployee } from './employee';

export interface TimekeepingRecord {
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  date: string; // YYYY-MM-DD
  day_of_week: string;
  clock_in_1: string;
  clock_out_1: string;
  clock_in_2: string;
  clock_out_2: string;
  clock_in_3: string;
  clock_out_3: string;
  work_count: number;
  work_hours: number;
  ot_hours_regular: number;
  ot_hours_sunday: number;
  ot_hours_holiday: number;
  total_hours: number;
  shift_name: string;
  symbol_code: string;
  symbol_code_plus: string;
}

// Function to parse date from DD/MM/YYYY to YYYY-MM-DD
function parseCSVDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Parse number replacing comma with dot
function parseCSVNumber(numStr: string): number {
  if (!numStr) return 0;
  const clean = numStr.replace(/\s/g, '').replace(/,/g, '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Format time string or return null if empty to prevent PG errors
function formatTimeVal(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '' || timeStr.trim() === '-') {
    return null;
  }
  const clean = timeStr.trim();
  if (clean.split(':').length === 2) {
    return `${clean}:00`;
  }
  return clean;
}

export async function parseAndSaveTimekeeping(csvContent: string, cycleId: string, fileName: string = 'import.csv') {
  // Check cycle status first!
  const cycleRes = await query("SELECT status FROM payroll_cycles WHERE id = $1", [cycleId]);
  if (cycleRes.rows.length === 0) {
    throw new Error("Không tìm thấy chu kỳ tính lương.");
  }
  const status = cycleRes.rows[0].status;
  if (['locked', 'paid', 'cancelled'].includes(status)) {
    throw new Error(`Kỳ lương này đang ở trạng thái "${status}" và đã được khóa. Không thể nhập dữ liệu chấm công mới.`);
  }

  const lines = csvContent.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('Tệp chấm công rỗng.');
  }

  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Mã N.Viên') || lines[i].includes('Mã nhân viên')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Không tìm thấy dòng tiêu đề của tệp chấm công.');
  }

  const headerCols = lines[headerIndex].split('\t').map(c => c.trim());
  const dataLines = lines.slice(headerIndex + 1);

  const colMap = {
    employeeId: headerCols.indexOf('Mã N.Viên'),
    name: headerCols.indexOf('Tên nhân viên'),
    department: headerCols.indexOf('Phòng ban'),
    position: headerCols.indexOf('Chức vụ'),
    date: headerCols.indexOf('Ngày'),
    dayOfWeek: headerCols.indexOf('Thứ'),
    v1: headerCols.indexOf('Vào 1'),
    r1: headerCols.indexOf('Ra 1'),
    v2: headerCols.indexOf('Vào 2'),
    r2: headerCols.indexOf('Ra 2'),
    v3: headerCols.indexOf('Vào 3'),
    r3: headerCols.indexOf('Ra 3'),
    cong: headerCols.indexOf('Công'),
    gio: headerCols.indexOf('Giờ'),
    tc1: headerCols.indexOf('TC1'),
    tc2: headerCols.indexOf('TC2'),
    tc3: headerCols.indexOf('TC3'),
    shift: headerCols.indexOf('Tên ca'),
    symbol: headerCols.indexOf('Kí hiệu'),
    symbolPlus: headerCols.indexOf('Kí hiệu+'),
    totalHours: headerCols.indexOf('Tổng giờ')
  };

  if (colMap.employeeId === -1 || colMap.date === -1) {
    throw new Error('Tệp chấm công thiếu các cột bắt buộc: Mã N.Viên, Ngày.');
  }

  let validCount = 0;
  let invalidCount = 0;

  await query('BEGIN');
  try {
    // 1. Create audit record
    const importRes = await query(`
      INSERT INTO attendance_imports (cycle_id, file_name, source_type, status, total_rows)
      VALUES ($1, $2, 'csv', 'uploaded', $3)
      RETURNING id
    `, [cycleId, fileName, dataLines.filter(l => l.trim()).length]);
    const importId = importRes.rows[0].id;

    // 2. Delete existing attendance records for this cycle
    await query('DELETE FROM attendance_records WHERE cycle_id = $1', [cycleId]);

    for (const line of dataLines) {
      if (!line.trim()) continue;
      const cols = line.split('\t');
      
      const empId = cols[colMap.employeeId]?.trim();
      const rawDate = cols[colMap.date]?.trim();
      
      if (!empId || !rawDate || empId === 'Mã N.Viên' || empId === 'Mã nhân viên') {
        continue;
      }

      const rowJsonData = JSON.stringify(cols);
      const formattedDate = parseCSVDate(rawDate);
      if (!formattedDate) {
        // Record as invalid row
        await query(`
          INSERT INTO attendance_import_rows (import_id, employee_id, row_data, status, error_message)
          VALUES ($1, $2, $3, 'invalid', $4)
        `, [importId, empId, rowJsonData, 'Định dạng ngày chấm công không hợp lệ.']);
        invalidCount++;
        continue;
      }

      // Verify employee exists
      const employee = await getEmployeeById(empId);
      if (!employee) {
        // Unmapped employee - record as invalid
        await query(`
          INSERT INTO attendance_import_rows (import_id, employee_id, row_data, status, error_message)
          VALUES ($1, $2, $3, 'invalid', $4)
        `, [importId, empId, rowJsonData, `Mã nhân viên "${empId}" không tồn tại trong hệ thống.`]);
        invalidCount++;
        continue;
      }

      const dayOfWeek = cols[colMap.dayOfWeek]?.trim() || '';
      const v1 = formatTimeVal(cols[colMap.v1]);
      const r1 = formatTimeVal(cols[colMap.r1]);
      const v2 = formatTimeVal(cols[colMap.v2]);
      const r2 = formatTimeVal(cols[colMap.r2]);
      const v3 = formatTimeVal(cols[colMap.v3]);
      const r3 = formatTimeVal(cols[colMap.r3]);
      
      const workCount = parseCSVNumber(cols[colMap.cong]);
      const workHours = parseCSVNumber(cols[colMap.gio]);
      const otHoursReg = parseCSVNumber(cols[colMap.tc1]);
      const otHoursSun = parseCSVNumber(cols[colMap.tc2]);
      const otHoursHol = parseCSVNumber(cols[colMap.tc3]);
      const totalHours = parseCSVNumber(cols[colMap.totalHours]);
      
      const shiftName = cols[colMap.shift]?.trim() || '';
      const symbolCode = cols[colMap.symbol]?.trim() || '';
      const symbolCodePlus = cols[colMap.symbolPlus]?.trim() || '';

      const sql = `
        INSERT INTO attendance_records (
          cycle_id, employee_id, import_id, work_date, day_of_week,
          clock_in_1, clock_out_1, clock_in_2, clock_out_2, clock_in_3, clock_out_3,
          work_count, work_hours, ot_hours_regular, ot_hours_sunday, ot_hours_holiday,
          shift_name, symbol_code, symbol_code_plus, total_hours
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20
        )
      `;
      await query(sql, [
        cycleId, empId, importId, formattedDate, dayOfWeek,
        v1, r1, v2, r2, v3, r3,
        workCount, workHours, otHoursReg, otHoursSun, otHoursHol,
        shiftName, symbolCode, symbolCodePlus, totalHours
      ]);

      // Record as valid row
      await query(`
        INSERT INTO attendance_import_rows (import_id, employee_id, row_data, status)
        VALUES ($1, $2, $3, 'valid')
      `, [importId, empId, rowJsonData]);

      validCount++;
    }

    // 3. Mark import as processed
    await query(`
      UPDATE attendance_imports 
      SET status = 'processed', valid_rows = $2, invalid_rows = $3
      WHERE id = $1
    `, [importId, validCount, invalidCount]);

    await query('COMMIT');
    return { success: true, importedCount: validCount, invalidCount, newEmployeesCount: 0 };
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function getTimekeepingRecords(
  cycleId: string,
  employeeId?: string,
  page?: number,
  limit?: number,
  sortBy: string = 'date',
  sortOrder: 'ASC' | 'DESC' = 'ASC',
  search?: string
): Promise<{ data: any[]; total: number }> {
  let sortField = 't.work_date';
  if (sortBy === 'employee_id') sortField = 't.employee_id';
  else if (sortBy === 'employee_name') sortField = 'e.full_name';
  else if (sortBy === 'work_count') sortField = 't.work_count';
  else if (sortBy === 'work_hours') sortField = 't.work_hours';
  else if (sortBy === 'ot_hours_1' || sortBy === 'ot_hours_regular') sortField = 't.ot_hours_regular';
  else if (sortBy === 'ot_hours_2' || sortBy === 'ot_hours_sunday') sortField = 't.ot_hours_sunday';
  else if (sortBy === 'total_hours') sortField = 't.total_hours';

  const sanitizedOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let sql = `
    FROM attendance_records t 
    JOIN employees e ON t.employee_id = e.id 
    WHERE t.cycle_id = $1 AND e.deleted_at IS NULL
  `;
  const params: any[] = [cycleId];

  if (employeeId) {
    params.push(employeeId);
    sql += ` AND t.employee_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (e.full_name ILIKE $${params.length} OR t.employee_id ILIKE $${params.length})`;
  }

  const countRes = await query(`SELECT COUNT(*) as count ${sql}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  let querySql = `
    SELECT t.id, t.employee_id, e.full_name as employee_name, e.department_name as department, e.position,
           t.work_date as date, t.day_of_week, 
           t.clock_in_1, t.clock_out_1, t.clock_in_2, t.clock_out_2, t.clock_in_3, t.clock_out_3,
           t.work_count, t.work_hours, t.ot_hours_regular, t.ot_hours_sunday, t.ot_hours_holiday, t.total_hours,
           t.shift_name, t.symbol_code, t.symbol_code_plus
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

export async function getTimekeepingSummary(cycleId: string) {
  const sql = `
    SELECT 
      t.employee_id,
      e.full_name as employee_name,
      e.department_name as department,
      e.position,
      SUM(t.work_count) as total_workdays,
      SUM(CASE WHEN t.symbol_code = 'PN' THEN t.work_count ELSE 0 END) as leave_days,
      SUM(CASE WHEN t.symbol_code = 'L' THEN t.work_count ELSE 0 END) as holiday_days,
      SUM(t.ot_hours_regular) as ot_hours_regular,
      SUM(t.ot_hours_sunday) as ot_hours_sunday,
      SUM(t.ot_hours_holiday) as ot_hours_holiday
    FROM attendance_records t
    JOIN employees e ON t.employee_id = e.id
    WHERE t.cycle_id = $1 AND e.deleted_at IS NULL
    GROUP BY t.employee_id, e.full_name, e.department_name, e.position
    ORDER BY t.employee_id ASC
  `;
  const res = await query(sql, [cycleId]);
  return res.rows;
}
