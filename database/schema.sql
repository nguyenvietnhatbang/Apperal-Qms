-- PostgreSQL schema for the shared-login payroll application.
-- Apply with: psql "$DATABASEURL" -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'locked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
    CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'terminated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_cycle_status') THEN
    CREATE TYPE payroll_cycle_status AS ENUM (
      'draft',
      'imported',
      'cleaned',
      'calculated',
      'locked',
      'paid',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_import_status') THEN
    CREATE TYPE attendance_import_status AS ENUM ('uploaded', 'validated', 'processed', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  route_path varchar(255) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS department_module_permissions (
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, module_id)
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  username varchar(80) NOT NULL UNIQUE,
  display_name varchar(150) NOT NULL,
  email varchar(255) UNIQUE,
  password_hash text NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  is_admin boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) NOT NULL UNIQUE,
  full_name varchar(180) NOT NULL,
  gender varchar(20),
  department_name varchar(150),
  position_title varchar(150),
  joined_date date,
  status employee_status NOT NULL DEFAULT 'active',
  dependent_count integer NOT NULL DEFAULT 0,
  has_child_under_6 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS employee_salary_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  total_salary numeric(14,2) NOT NULL DEFAULT 0,
  insurance_salary numeric(14,2) NOT NULL DEFAULT 0,
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  position_allowance numeric(14,2) NOT NULL DEFAULT 0,
  responsibility_allowance numeric(14,2) NOT NULL DEFAULT 0,
  seniority_allowance numeric(14,2) NOT NULL DEFAULT 0,
  safety_allowance numeric(14,2) NOT NULL DEFAULT 0,
  phone_allowance numeric(14,2) NOT NULL DEFAULT 0,
  travel_allowance numeric(14,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(14,2) NOT NULL DEFAULT 0,
  attendance_bonus numeric(14,2) NOT NULL DEFAULT 0,
  other_bonus numeric(14,2) NOT NULL DEFAULT 0,
  meal_allowance numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  value numeric(14,4) NOT NULL,
  unit varchar(30) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  standard_workdays numeric(8,2) NOT NULL DEFAULT 26,
  standard_hours_per_day numeric(8,2) NOT NULL DEFAULT 8,
  status payroll_cycle_status NOT NULL DEFAULT 'draft',
  calculated_at timestamptz,
  locked_at timestamptz,
  paid_at timestamptz,
  note text,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_cycle_date_range CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS attendance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  source_kind varchar(30) NOT NULL DEFAULT 'csv',
  status attendance_import_status NOT NULL DEFAULT 'uploaded',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS attendance_raw_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES attendance_imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  import_id uuid REFERENCES attendance_imports(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_code varchar(50) NOT NULL,
  employee_name varchar(180) NOT NULL,
  work_date date NOT NULL,
  weekday_name varchar(30),
  department_name varchar(150),
  position_title varchar(150),
  shift_name varchar(80),
  check_in_1 time,
  check_out_1 time,
  check_in_2 time,
  check_out_2 time,
  check_in_3 time,
  check_out_3 time,
  workday_count numeric(8,2) NOT NULL DEFAULT 0,
  work_hours numeric(8,2) NOT NULL DEFAULT 0,
  extra_workday_count numeric(8,2) NOT NULL DEFAULT 0,
  extra_hours numeric(8,2) NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  symbol varchar(50),
  extra_symbol varchar(50),
  total_hours numeric(8,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_cycle_id, employee_code, work_date)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_code varchar(50) NOT NULL,
  employee_name varchar(180) NOT NULL,
  salary_config_snapshot jsonb NOT NULL,
  rule_snapshot jsonb NOT NULL,
  actual_workdays numeric(8,2) NOT NULL DEFAULT 0,
  paid_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  holiday_days numeric(8,2) NOT NULL DEFAULT 0,
  unpaid_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  monthly_salary_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_income numeric(14,2) NOT NULL DEFAULT 0,
  company_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  employee_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  union_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  personal_income_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_1 numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_2 numeric(14,2) NOT NULL DEFAULT 0,
  total_deduction numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  second_payment_amount numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_cycle_id, employee_code)
);

CREATE TABLE IF NOT EXISTS payroll_item_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
  line_code varchar(80) NOT NULL,
  line_name varchar(180) NOT NULL,
  quantity numeric(14,4),
  rate numeric(14,4),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  line_type varchar(30) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  previous_status payroll_cycle_status,
  next_status payroll_cycle_status,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_department_permissions_module
  ON department_module_permissions (module_id);

CREATE INDEX IF NOT EXISTS idx_app_users_department_status
  ON app_users (department_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires
  ON user_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_search
  ON employees (employee_code, full_name, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_salary_configs_employee_effective
  ON employee_salary_configs (employee_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_payroll_cycles_period_status
  ON payroll_cycles (period_start, period_end, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_cycle_employee_date
  ON attendance_records (payroll_cycle_id, employee_code, work_date);

CREATE INDEX IF NOT EXISTS idx_payroll_items_cycle_employee
  ON payroll_items (payroll_cycle_id, employee_code);

INSERT INTO modules (code, name, description, route_path, sort_order)
VALUES
  ('auth', 'Auth', 'Quản lý người dùng, phòng ban và phân quyền module.', '/auth', 10),
  ('payroll', 'Chấm công / Tính lương', 'Quản lý nhân viên, chấm công, chu kỳ lương và phiếu lương.', '/payroll', 20)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_path = EXCLUDED.route_path,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO departments (code, name, description, is_admin)
VALUES ('admin', 'Admin', 'Phòng ban/quyền quản trị toàn hệ thống.', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_admin = EXCLUDED.is_admin,
  updated_at = now();

INSERT INTO department_module_permissions (
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
WHERE d.code = 'admin'
ON CONFLICT (department_id, module_id) DO UPDATE
SET
  can_view = true,
  can_create = true,
  can_update = true,
  can_delete = true,
  can_approve = true,
  updated_at = now();

INSERT INTO payroll_rules (code, name, value, unit, description)
VALUES
  ('standard_hours_per_day', 'Số giờ công chuẩn mỗi ngày', 8, 'hours', 'Dùng để quy đổi lương ngày sang lương giờ.'),
  ('overtime_normal_rate', 'Hệ số tăng ca ngày thường', 1.5, 'multiplier', 'Theo mẫu phiếu lương: tăng ca thường 150%.'),
  ('overtime_sunday_rate', 'Hệ số tăng ca Chủ Nhật', 2, 'multiplier', 'Theo mẫu phiếu lương: tăng ca Chủ Nhật 200%.'),
  ('overtime_holiday_rate', 'Hệ số tăng ca ngày lễ', 3, 'multiplier', 'Theo mẫu phiếu lương: tăng ca lễ 300%.'),
  ('employee_insurance_rate', 'BHXH/BHYT/BHTN khấu trừ nhân viên', 0.105, 'percent', 'Theo mẫu phiếu lương: khấu trừ 10,5%.'),
  ('company_social_insurance_rate', 'BHXH công ty đóng', 0.175, 'percent', 'Theo bảng lương: BHXH 17,5% công ty trả.'),
  ('company_health_insurance_rate', 'BHYT công ty đóng', 0.03, 'percent', 'Theo bảng lương: BHYT 3% công ty trả.'),
  ('company_unemployment_insurance_rate', 'BHTN công ty đóng', 0.01, 'percent', 'Theo bảng lương: BHTN 1% công ty trả.'),
  ('company_union_rate', 'Công đoàn công ty đóng', 0.02, 'percent', 'Theo bảng lương: công đoàn 2%.'),
  ('employee_union_rate', 'Đoàn phí nhân viên', 0.01, 'percent', 'Theo phiếu lương có dòng đoàn phí 1%.')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description,
  updated_at = now();

-- Optional bootstrap user.
-- Username: admin
-- Temporary password: Admin@123
-- Change the password immediately after first login.
INSERT INTO app_users (
  department_id,
  username,
  display_name,
  password_hash,
  status,
  is_admin
)
SELECT
  d.id,
  'admin',
  'System Admin',
  'scrypt:16384:8:1:3fae3ef7183265126731e214ae787763:4b1df4f6c3c88710843fa189029411fa68c4066d1132148cfc0373335422979e6500e7cf14762a630650fa3f8a2f0533ab26815181c00f425e429e7d9da8f916',
  'active',
  true
FROM departments d
WHERE d.code = 'admin'
ON CONFLICT (username) DO NOTHING;
