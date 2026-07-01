import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __appPgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASEURL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing DATABASEURL environment variable");
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export function getPool() {
  if (!globalThis.__appPgPool) {
    globalThis.__appPgPool = createPool();
  }

  return globalThis.__appPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
