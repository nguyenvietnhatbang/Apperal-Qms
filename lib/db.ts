import { Pool } from 'pg';

const connectionString = process.env.DATABASEURL;

if (!connectionString) {
  throw new Error('DATABASEURL env variable is not defined');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Neon SSL config
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}
