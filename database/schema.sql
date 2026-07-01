BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL UNIQUE,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, module_id)
);

CREATE TABLE IF NOT EXISTS employees (
  id varchar(50) PRIMARY KEY,
  full_name varchar(150) NOT NULL,
  gender varchar(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  department_name varchar(100) NOT NULL,
  position varchar(100) NOT NULL,
  join_date date,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  display_name varchar(100) NOT NULL,
  employee_id varchar(50) REFERENCES employees(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS employee_salary_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  total_salary numeric(15,2) NOT NULL DEFAULT 0,
  insurance_salary numeric(15,2) NOT NULL DEFAULT 0,
  basic_salary numeric(15,2) NOT NULL DEFAULT 0,
  allowance_title numeric(15,2) NOT NULL DEFAULT 0,
  allowance_responsibility numeric(15,2) NOT NULL DEFAULT 0,
  allowance_seniority numeric(15,2) NOT NULL DEFAULT 0,
  allowance_safety numeric(15,2) NOT NULL DEFAULT 0,
  allowance_phone numeric(15,2) NOT NULL DEFAULT 0,
  allowance_other numeric(15,2) NOT NULL DEFAULT 0,
  allowance_travel numeric(15,2) NOT NULL DEFAULT 0,
  allowance_housing numeric(15,2) NOT NULL DEFAULT 0,
  children_under_6_count integer NOT NULL DEFAULT 0 CHECK (children_under_6_count >= 0),
  dependents_count integer NOT NULL DEFAULT 0 CHECK (dependents_count >= 0),
  is_union_member boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (employee_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES payroll_rule_sets(id) ON DELETE CASCADE,
  key varchar(80) NOT NULL,
  value_numeric numeric(15,4),
  value_text varchar(255),
  description varchar(255),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL),
  UNIQUE (rule_set_id, key)
);

CREATE TABLE IF NOT EXISTS payroll_cycles (
  id varchar(50) PRIMARY KEY,
  name varchar(100) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  rule_set_id uuid REFERENCES payroll_rule_sets(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'imported', 'calculated', 'locked', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  calculated_at timestamptz,
  locked_at timestamptz,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS attendance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id varchar(50) NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  source_type varchar(30) NOT NULL DEFAULT 'excel' CHECK (source_type IN ('excel', 'csv')),
  status varchar(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processed', 'failed')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_import_rows (
  id bigserial PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES attendance_imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'invalid', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (import_id, row_number)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id bigserial PRIMARY KEY,
  cycle_id varchar(50) NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id varchar(50) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  import_id uuid REFERENCES attendance_imports(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  day_of_week varchar(20),
  clock_in_1 time,
  clock_out_1 time,
  clock_in_2 time,
  clock_out_2 time,
  clock_in_3 time,
  clock_out_3 time,
  work_count numeric(5,2) NOT NULL DEFAULT 0,
  work_hours numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_regular numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_sunday numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_holiday numeric(6,2) NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  shift_name varchar(50),
  symbol_code varchar(50),
  symbol_code_plus varchar(50),
  total_hours numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cycle_id, employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS payroll_results (
  id bigserial PRIMARY KEY,
  cycle_id varchar(50) NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id varchar(50) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  salary_config_snapshot jsonb NOT NULL,
  rule_snapshot jsonb NOT NULL,
  total_workdays numeric(6,2) NOT NULL DEFAULT 0,
  leave_days numeric(6,2) NOT NULL DEFAULT 0,
  holiday_days numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_regular numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_sunday numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours_holiday numeric(6,2) NOT NULL DEFAULT 0,
  salary_workdays numeric(15,2) NOT NULL DEFAULT 0,
  salary_leave_holiday numeric(15,2) NOT NULL DEFAULT 0,
  total_allowances numeric(15,2) NOT NULL DEFAULT 0,
  ot_pay_regular numeric(15,2) NOT NULL DEFAULT 0,
  ot_pay_sunday numeric(15,2) NOT NULL DEFAULT 0,
  ot_pay_holiday numeric(15,2) NOT NULL DEFAULT 0,
  gross_income numeric(15,2) NOT NULL DEFAULT 0,
  deduction_insurance numeric(15,2) NOT NULL DEFAULT 0,
  deduction_union numeric(15,2) NOT NULL DEFAULT 0,
  taxable_income numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  net_salary numeric(15,2) NOT NULL DEFAULT 0,
  advance_1 numeric(15,2) NOT NULL DEFAULT 0,
  advance_2 numeric(15,2) NOT NULL DEFAULT 0,
  remaining_salary numeric(15,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_department_permissions_department ON department_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_department_permissions_module ON department_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_salary_configs_employee_effective ON employee_salary_configs(employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_cycles_dates ON payroll_cycles(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_attendance_imports_cycle ON attendance_imports(cycle_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_cycle_employee ON attendance_records(cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_payroll_results_cycle ON payroll_results(cycle_id);
CREATE INDEX IF NOT EXISTS idx_payroll_results_employee ON payroll_results(employee_id);

INSERT INTO modules (code, name)
VALUES
  ('auth', 'Auth'),
  ('payroll', 'Chấm công / Tính lương')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO departments (code, name, is_admin)
VALUES
  ('admin', 'Admin', true),
  ('hr_payroll', 'Nhân sự / Tính lương', false)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_admin = EXCLUDED.is_admin,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO department_permissions (
  department_id,
  module_id,
  can_view,
  can_create,
  can_update,
  can_delete,
  can_approve
)
SELECT d.id, m.id, true, true, true, true, true
FROM departments d
CROSS JOIN modules m
WHERE d.code = 'hr_payroll'
  AND m.code IN ('auth', 'payroll')
ON CONFLICT (department_id, module_id) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    can_approve = EXCLUDED.can_approve,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payroll_rule_sets (name, effective_from, is_default)
VALUES ('Quy tắc mặc định', DATE '2026-01-01', true)
ON CONFLICT DO NOTHING;

INSERT INTO payroll_rules (rule_set_id, key, value_numeric, description)
SELECT rs.id, rule.key, rule.value_numeric, rule.description
FROM payroll_rule_sets rs
CROSS JOIN (
  VALUES
    ('working_days_standard', 26.0000, 'Số ngày công chuẩn trong tháng'),
    ('work_hours_per_day', 8.0000, 'Số giờ làm việc chuẩn mỗi ngày'),
    ('regular_ot_multiplier', 1.5000, 'Hệ số tăng ca ngày thường'),
    ('sunday_ot_multiplier', 2.0000, 'Hệ số tăng ca Chủ Nhật'),
    ('holiday_ot_multiplier', 3.0000, 'Hệ số tăng ca ngày lễ'),
    ('employee_insurance_rate', 0.1050, 'Tỷ lệ BHXH/BHYT/BHTN người lao động khấu trừ'),
    ('union_fee_rate', 0.0100, 'Tỷ lệ đoàn phí nếu tính theo lương'),
    ('union_fee_flat', 30000.0000, 'Mức đoàn phí cố định mặc định'),
    ('female_allowance_hours', 1.5000, 'Số giờ hỗ trợ hành kinh cho lao động nữ'),
    ('child_under_6_allowance', 100000.0000, 'Phụ cấp con nhỏ dưới 6 tuổi mỗi bé'),
    ('personal_tax_deduction', 11000000.0000, 'Giảm trừ bản thân'),
    ('dependent_tax_deduction', 4400000.0000, 'Giảm trừ mỗi người phụ thuộc')
) AS rule(key, value_numeric, description)
WHERE rs.name = 'Quy tắc mặc định'
  AND rs.is_default = true
ON CONFLICT (rule_set_id, key) DO UPDATE
SET value_numeric = EXCLUDED.value_numeric,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
