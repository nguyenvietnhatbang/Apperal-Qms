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

CREATE TABLE IF NOT EXISTS factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  code varchar(50) NOT NULL,
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
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
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

CREATE TABLE IF NOT EXISTS user_factory_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  employee_code varchar(50) NOT NULL,
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
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  code varchar(80) NOT NULL,
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
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  code varchar(50) NOT NULL,
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

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  annual_leave_total numeric(8,2) NOT NULL DEFAULT 0,
  paid_leave_hours numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_used_cumulative numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_remaining numeric(8,2) NOT NULL DEFAULT 0,
  personal_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  personal_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  business_trip_allowance numeric(14,2) NOT NULL DEFAULT 0,
  compliance_bonus numeric(14,2) NOT NULL DEFAULT 0,
  work_trip_support numeric(14,2) NOT NULL DEFAULT 0,
  night_shift_hours numeric(8,2) NOT NULL DEFAULT 0,
  night_shift_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_1 numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_2 numeric(14,2) NOT NULL DEFAULT 0,
  pending_leave_advance numeric(14,2) NOT NULL DEFAULT 0,
  actual_workdays_override numeric(8,2),
  paid_leave_days_override numeric(8,2),
  holiday_days_override numeric(8,2),
  overtime_normal_hours_override numeric(8,2),
  overtime_sunday_hours_override numeric(8,2),
  overtime_holiday_hours_override numeric(8,2),
  employee_insurance_amount_override numeric(14,2),
  union_fee_amount_override numeric(14,2),
  personal_income_tax_amount_override numeric(14,2),
  menstrual_allowance_amount_override numeric(14,2),
  child_allowance_amount_override numeric(14,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_cycle_id, employee_id)
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
  paid_leave_hours numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_total numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_used_cumulative numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_remaining numeric(8,2) NOT NULL DEFAULT 0,
  holiday_days numeric(8,2) NOT NULL DEFAULT 0,
  personal_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  unpaid_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  night_shift_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  monthly_salary_amount numeric(14,2) NOT NULL DEFAULT 0,
  personal_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  night_shift_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  business_trip_allowance numeric(14,2) NOT NULL DEFAULT 0,
  compliance_bonus numeric(14,2) NOT NULL DEFAULT 0,
  work_trip_support numeric(14,2) NOT NULL DEFAULT 0,
  menstrual_allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  child_allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_income numeric(14,2) NOT NULL DEFAULT 0,
  company_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  employee_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  union_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  personal_income_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_1 numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_2 numeric(14,2) NOT NULL DEFAULT 0,
  pending_leave_advance numeric(14,2) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS audit_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  code varchar(80) NOT NULL,
  name varchar(150) NOT NULL,
  max_overtime_hours_per_day numeric(8,2) NOT NULL DEFAULT 4,
  max_overtime_hours_per_month numeric(8,2) NOT NULL DEFAULT 40,
  max_overtime_hours_per_year numeric(8,2) NOT NULL DEFAULT 300,
  allow_sunday_work boolean NOT NULL DEFAULT false,
  enable_overtime_tier_2 boolean NOT NULL DEFAULT false,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  source_attendance_record_id uuid REFERENCES attendance_records(id) ON DELETE SET NULL,
  audit_config_id uuid REFERENCES audit_configs(id) ON DELETE SET NULL,
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
  original_workday_count numeric(8,2) NOT NULL DEFAULT 0,
  original_work_hours numeric(8,2) NOT NULL DEFAULT 0,
  original_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  original_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  original_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  workday_count numeric(8,2) NOT NULL DEFAULT 0,
  work_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  symbol varchar(50),
  extra_symbol varchar(50),
  total_hours numeric(8,2) NOT NULL DEFAULT 0,
  adjustment_reason jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_cycle_id, employee_code, work_date)
);

CREATE TABLE IF NOT EXISTS audit_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_cycle_id uuid NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_code varchar(50) NOT NULL,
  employee_name varchar(180) NOT NULL,
  salary_config_snapshot jsonb NOT NULL,
  rule_snapshot jsonb NOT NULL,
  audit_config_snapshot jsonb NOT NULL,
  actual_workdays numeric(8,2) NOT NULL DEFAULT 0,
  paid_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  paid_leave_hours numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_total numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_used_cumulative numeric(8,2) NOT NULL DEFAULT 0,
  annual_leave_remaining numeric(8,2) NOT NULL DEFAULT 0,
  holiday_days numeric(8,2) NOT NULL DEFAULT 0,
  personal_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  unpaid_leave_days numeric(8,2) NOT NULL DEFAULT 0,
  overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  night_shift_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0,
  monthly_salary_amount numeric(14,2) NOT NULL DEFAULT 0,
  personal_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_leave_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  night_shift_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess_overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0,
  allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  business_trip_allowance numeric(14,2) NOT NULL DEFAULT 0,
  compliance_bonus numeric(14,2) NOT NULL DEFAULT 0,
  work_trip_support numeric(14,2) NOT NULL DEFAULT 0,
  menstrual_allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  child_allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_income numeric(14,2) NOT NULL DEFAULT 0,
  company_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  employee_insurance_amount numeric(14,2) NOT NULL DEFAULT 0,
  union_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  personal_income_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_1 numeric(14,2) NOT NULL DEFAULT 0,
  advance_payment_2 numeric(14,2) NOT NULL DEFAULT 0,
  pending_leave_advance numeric(14,2) NOT NULL DEFAULT 0,
  total_deduction numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  second_payment_amount numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_cycle_id, employee_code)
);

CREATE TABLE IF NOT EXISTS audit_payroll_item_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_payroll_item_id uuid NOT NULL REFERENCES audit_payroll_items(id) ON DELETE CASCADE,
  line_code varchar(80) NOT NULL,
  line_name varchar(180) NOT NULL,
  quantity numeric(14,4),
  rate numeric(14,4),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  line_type varchar(30) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO factories (code, name, description, is_active)
VALUES ('default', 'Xưởng mặc định', 'Xưởng mặc định dùng để giữ dữ liệu hiện có khi nâng cấp nhiều xưởng.', true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE departments ADD COLUMN IF NOT EXISTS factory_id uuid;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS factory_id uuid;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS factory_id uuid;
ALTER TABLE payroll_cycles ADD COLUMN IF NOT EXISTS factory_id uuid;
ALTER TABLE payroll_rules ADD COLUMN IF NOT EXISTS factory_id uuid;
ALTER TABLE audit_configs ADD COLUMN IF NOT EXISTS factory_id uuid;

ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS paid_leave_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS annual_leave_total numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS annual_leave_used_cumulative numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS annual_leave_remaining numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS personal_leave_days numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS night_shift_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS personal_leave_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS night_shift_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS business_trip_allowance numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS compliance_bonus numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS work_trip_support numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS menstrual_allowance_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS child_allowance_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS pending_leave_advance numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS actual_workdays_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS paid_leave_days_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS holiday_days_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS overtime_normal_hours_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS overtime_sunday_hours_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS overtime_holiday_hours_override numeric(8,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS employee_insurance_amount_override numeric(14,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS union_fee_amount_override numeric(14,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS personal_income_tax_amount_override numeric(14,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS menstrual_allowance_amount_override numeric(14,2);
ALTER TABLE payroll_adjustments ADD COLUMN IF NOT EXISTS child_allowance_amount_override numeric(14,2);

ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS paid_leave_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS annual_leave_total numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS annual_leave_used_cumulative numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS annual_leave_remaining numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS personal_leave_days numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS night_shift_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_normal_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_sunday_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_holiday_hours numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS personal_leave_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS night_shift_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_normal_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_sunday_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS excess_overtime_holiday_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS business_trip_allowance numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS compliance_bonus numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS work_trip_support numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS menstrual_allowance_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS child_allowance_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE audit_payroll_items ADD COLUMN IF NOT EXISTS pending_leave_advance numeric(14,2) NOT NULL DEFAULT 0;

UPDATE departments
SET factory_id = (SELECT id FROM factories WHERE code = 'default')
WHERE factory_id IS NULL;

UPDATE app_users
SET factory_id = COALESCE(
  (SELECT factory_id FROM departments WHERE departments.id = app_users.department_id),
  (SELECT id FROM factories WHERE code = 'default')
)
WHERE factory_id IS NULL;

UPDATE employees
SET factory_id = (SELECT id FROM factories WHERE code = 'default')
WHERE factory_id IS NULL;

UPDATE payroll_cycles
SET factory_id = (SELECT id FROM factories WHERE code = 'default')
WHERE factory_id IS NULL;

UPDATE payroll_rules
SET factory_id = (SELECT id FROM factories WHERE code = 'default')
WHERE factory_id IS NULL;

UPDATE audit_configs
SET factory_id = (SELECT id FROM factories WHERE code = 'default')
WHERE factory_id IS NULL;

ALTER TABLE departments ALTER COLUMN factory_id SET NOT NULL;
ALTER TABLE app_users ALTER COLUMN factory_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN factory_id SET NOT NULL;
ALTER TABLE payroll_cycles ALTER COLUMN factory_id SET NOT NULL;
ALTER TABLE payroll_rules ALTER COLUMN factory_id SET NOT NULL;
ALTER TABLE audit_configs ALTER COLUMN factory_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
  ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
  ALTER TABLE payroll_cycles DROP CONSTRAINT IF EXISTS payroll_cycles_code_key;
  ALTER TABLE payroll_rules DROP CONSTRAINT IF EXISTS payroll_rules_code_key;
  ALTER TABLE audit_configs DROP CONSTRAINT IF EXISTS audit_configs_code_key;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_factory_fk') THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_factory_fk') THEN
    ALTER TABLE app_users
      ADD CONSTRAINT app_users_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_factory_fk') THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_cycles_factory_fk') THEN
    ALTER TABLE payroll_cycles
      ADD CONSTRAINT payroll_cycles_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_rules_factory_fk') THEN
    ALTER TABLE payroll_rules
      ADD CONSTRAINT payroll_rules_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_configs_factory_fk') THEN
    ALTER TABLE audit_configs
      ADD CONSTRAINT audit_configs_factory_fk FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;
END $$;

INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
SELECT id, factory_id, department_id, true, true
FROM app_users
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_department_permissions_module
  ON department_module_permissions (module_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_factory_code_unique
  ON departments (factory_id, code);

CREATE INDEX IF NOT EXISTS idx_app_users_department_status
  ON app_users (department_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_factory_status
  ON app_users (factory_id, status)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_factory_memberships_unique_active
  ON user_factory_memberships (user_id, factory_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_factory_memberships_factory
  ON user_factory_memberships (factory_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires
  ON user_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_factory_code_unique
  ON employees (factory_id, employee_code);

CREATE INDEX IF NOT EXISTS idx_employees_search
  ON employees (factory_id, employee_code, full_name, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_salary_configs_employee_effective
  ON employee_salary_configs (employee_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_payroll_cycles_period_status
  ON payroll_cycles (factory_id, period_start, period_end, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_cycles_factory_code_unique
  ON payroll_cycles (factory_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_rules_factory_code_unique
  ON payroll_rules (factory_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_configs_factory_code_unique
  ON audit_configs (factory_id, code);

CREATE INDEX IF NOT EXISTS idx_attendance_records_cycle_employee_date
  ON attendance_records (payroll_cycle_id, employee_code, work_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date_employee
  ON attendance_records (work_date, employee_id, employee_code, updated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_cycle_employee
  ON payroll_adjustments (payroll_cycle_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_items_cycle_employee
  ON payroll_items (payroll_cycle_id, employee_code);

CREATE INDEX IF NOT EXISTS idx_audit_attendance_cycle_employee_date
  ON audit_attendance_records (payroll_cycle_id, employee_code, work_date);

CREATE INDEX IF NOT EXISTS idx_audit_payroll_items_cycle_employee
  ON audit_payroll_items (payroll_cycle_id, employee_code);

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

INSERT INTO departments (factory_id, code, name, description, is_admin)
SELECT id, 'admin', 'Admin', 'Phòng ban/quyền quản trị toàn hệ thống.', true
FROM factories
WHERE code = 'default'
ON CONFLICT (factory_id, code) DO UPDATE
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
JOIN factories f ON f.id = d.factory_id
WHERE d.code = 'admin' AND f.code = 'default'
ON CONFLICT (department_id, module_id) DO UPDATE
SET
  can_view = true,
  can_create = true,
  can_update = true,
  can_delete = true,
  can_approve = true,
  updated_at = now();

INSERT INTO payroll_rules (factory_id, code, name, value, unit, description)
SELECT f.id, rule_data.code, rule_data.name, rule_data.value, rule_data.unit, rule_data.description
FROM factories f
CROSS JOIN (
  VALUES
    ('standard_hours_per_day', 'Số giờ công chuẩn mỗi ngày', 8::numeric, 'hours', 'Dùng để quy đổi lương ngày sang lương giờ.'),
    ('overtime_normal_rate', 'Hệ số tăng ca ngày thường', 1.5::numeric, 'multiplier', 'Theo mẫu phiếu lương: tăng ca thường 150%.'),
    ('overtime_sunday_rate', 'Hệ số tăng ca Chủ Nhật', 2::numeric, 'multiplier', 'Theo mẫu phiếu lương: tăng ca Chủ Nhật 200%.'),
    ('overtime_holiday_rate', 'Hệ số tăng ca ngày lễ', 3::numeric, 'multiplier', 'Theo mẫu phiếu lương: tăng ca lễ 300%.'),
    ('employee_insurance_rate', 'BHXH/BHYT/BHTN khấu trừ nhân viên', 0.105::numeric, 'percent', 'Theo mẫu phiếu lương: khấu trừ 10,5%.'),
    ('company_social_insurance_rate', 'BHXH công ty đóng', 0.175::numeric, 'percent', 'Theo bảng lương: BHXH 17,5% công ty trả.'),
    ('company_health_insurance_rate', 'BHYT công ty đóng', 0.03::numeric, 'percent', 'Theo bảng lương: BHYT 3% công ty trả.'),
    ('company_unemployment_insurance_rate', 'BHTN công ty đóng', 0.01::numeric, 'percent', 'Theo bảng lương: BHTN 1% công ty trả.'),
    ('company_union_rate', 'Công đoàn công ty đóng', 0.02::numeric, 'percent', 'Theo bảng lương: công đoàn 2%.'),
    ('employee_union_rate', 'Đoàn phí nhân viên', 0.01::numeric, 'percent', 'Theo phiếu lương có dòng đoàn phí 1%.')
) AS rule_data(code, name, value, unit, description)
WHERE f.code = 'default'
ON CONFLICT (factory_id, code) DO UPDATE
SET
  name = EXCLUDED.name,
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO audit_configs (
  factory_id,
  code,
  name,
  max_overtime_hours_per_day,
  max_overtime_hours_per_month,
  max_overtime_hours_per_year,
  allow_sunday_work,
  enable_overtime_tier_2,
  note
)
SELECT
  id,
  'default',
  'Audit bảng số 1',
  4,
  40,
  300,
  false,
  false,
  'Theo yêu cầu khách: không TC2, TC1 lấy số lẻ dưới hoặc bằng 4h/ngày, tối đa 40h/tháng, 300h/năm, không đi làm Chủ Nhật.'
FROM factories
WHERE code = 'default'
ON CONFLICT (factory_id, code) DO UPDATE
SET
  name = EXCLUDED.name,
  max_overtime_hours_per_day = EXCLUDED.max_overtime_hours_per_day,
  max_overtime_hours_per_month = EXCLUDED.max_overtime_hours_per_month,
  max_overtime_hours_per_year = EXCLUDED.max_overtime_hours_per_year,
  allow_sunday_work = EXCLUDED.allow_sunday_work,
  enable_overtime_tier_2 = EXCLUDED.enable_overtime_tier_2,
  note = EXCLUDED.note,
  updated_at = now();

-- Optional bootstrap user.
-- Username: admin
-- Temporary password: Admin@123
-- Change the password immediately after first login.
INSERT INTO app_users (
  factory_id,
  department_id,
  username,
  display_name,
  password_hash,
  status,
  is_admin
)
SELECT
  d.factory_id,
  d.id,
  'admin',
  'System Admin',
  'scrypt:16384:8:1:3fae3ef7183265126731e214ae787763:4b1df4f6c3c88710843fa189029411fa68c4066d1132148cfc0373335422979e6500e7cf14762a630650fa3f8a2f0533ab26815181c00f425e429e7d9da8f916',
  'active',
  true
FROM departments d
JOIN factories f ON f.id = d.factory_id
WHERE d.code = 'admin' AND f.code = 'default'
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
SELECT u.id, d.factory_id, d.id, true, true
FROM app_users u
JOIN departments d ON d.factory_id = u.factory_id
JOIN factories f ON f.id = d.factory_id
WHERE u.username = 'admin' AND d.code = 'admin' AND f.code = 'default'
ON CONFLICT DO NOTHING;

-- Optional audit-focused bootstrap user.
-- Username: admin2
-- Temporary password: Admin2@123
-- Change the password immediately after first login.
INSERT INTO app_users (
  factory_id,
  department_id,
  username,
  display_name,
  password_hash,
  status,
  is_admin
)
SELECT
  d.factory_id,
  d.id,
  'admin2',
  'Audit Admin',
  'scrypt:16384:8:1:84845d2b1cfff388061f369e71b8d82e:a2c2961c74204c5b4742c49a53ef61cb865530454b41951eb411b87145ec93b344b710b620093d7de9c5d6062dd460a5caef23f14b9ce58764ae2a69a72570e0',
  'active',
  true
FROM departments d
JOIN factories f ON f.id = d.factory_id
WHERE d.code = 'admin' AND f.code = 'default'
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
SELECT u.id, d.factory_id, d.id, true, true
FROM app_users u
JOIN departments d ON d.factory_id = u.factory_id
JOIN factories f ON f.id = d.factory_id
WHERE u.username = 'admin2' AND d.code = 'admin' AND f.code = 'default'
ON CONFLICT DO NOTHING;
