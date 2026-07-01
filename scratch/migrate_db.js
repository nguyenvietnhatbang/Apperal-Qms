const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read database URL from env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbUrlMatch = envContent.match(/DATABASEURL="([^"]+)"/);
if (!dbUrlMatch) {
  console.error('DATABASEURL not found in .env.local');
  process.exit(1);
}

const connectionString = dbUrlMatch[1];
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('--- STARTING DATABASE MIGRATION ---');

  // 1. Drop old tables in reverse dependency order
  console.log('Dropping legacy tables...');
  await pool.query(`
    DROP TABLE IF EXISTS payroll_results CASCADE;
    DROP TABLE IF EXISTS attendance_records CASCADE;
    DROP TABLE IF EXISTS attendance_import_rows CASCADE;
    DROP TABLE IF EXISTS attendance_imports CASCADE;
    DROP TABLE IF EXISTS employee_salary_configs CASCADE;
    DROP TABLE IF EXISTS payroll_rules CASCADE;
    DROP TABLE IF EXISTS payroll_rule_sets CASCADE;
    DROP TABLE IF EXISTS payroll_cycles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS employees CASCADE;
    DROP TABLE IF EXISTS department_permissions CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
    DROP TABLE IF EXISTS modules CASCADE;
    
    -- Also drop previously named tables just in case
    DROP TABLE IF EXISTS payroll_calculations CASCADE;
    DROP TABLE IF EXISTS timekeeping_records CASCADE;
  `);

  // 2. Read schema.sql content
  console.log('Reading database/schema.sql...');
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // 3. Execute schema
  console.log('Applying new schema definitions and default values...');
  await pool.query(schemaSql);

  // 4. Seed the Admin User
  console.log('Seeding admin user...');
  const adminDeptRes = await pool.query("SELECT id FROM departments WHERE code = 'admin'");
  if (adminDeptRes.rows.length === 0) {
    throw new Error('Admin department not found in database seed!');
  }
  const adminDeptId = adminDeptRes.rows[0].id;
  const adminPasswordHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // sha256 hash of 'admin'

  await pool.query(`
    INSERT INTO users (username, password_hash, display_name, department_id, status)
    VALUES ('admin', $1, 'Administrator', $2, 'active')
    ON CONFLICT (username) DO NOTHING;
  `, [adminPasswordHash, adminDeptId]);

  console.log('🎉 DATABASE MIGRATION AND SEEDING COMPLETED SUCCESSFULLY!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Error during migration:', err);
  process.exit(1);
});
