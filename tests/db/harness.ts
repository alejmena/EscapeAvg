import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const root = join(__dirname, "..", "..");

/** Recrea los esquemas desde cero y aplica el stub de Supabase + todas las migraciones. */
export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("drop schema if exists public cascade; drop schema if exists auth cascade;");
    await client.query("create schema public;");
    await client.query(readFileSync(join(root, "tests/db/supabase-stub.sql"), "utf8"));
    await client.query("grant usage on schema public to anon, authenticated;");
    const dir = join(root, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await client.query(readFileSync(join(dir, file), "utf8"));
    }
    // Equivalente a los privilegios por defecto de Supabase.
    await client.query(`
      grant select, insert, update, delete on all tables in schema public to anon, authenticated;
      grant usage, select on all sequences in schema public to anon, authenticated;
    `);
  } finally {
    await client.end();
  }
}

export async function adminClient(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}

/** Ejecuta SQL como superusuario sin disparar triggers (para preparar datos en el pasado). */
export async function rawUpdate(admin: Client, sql: string, params: unknown[] = []): Promise<void> {
  await admin.query("set session_replication_role = replica");
  try {
    await admin.query(sql, params);
  } finally {
    await admin.query("set session_replication_role = origin");
  }
}

export async function createUser(admin: Client, meta: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`u${Math.random().toString(36).slice(2)}@test.dev`, meta],
  );
  return rows[0].id;
}

/**
 * Ejecuta `fn` como el usuario autenticado `userId` (rol authenticated + claim sub),
 * igual que PostgREST en Supabase. Todo ocurre en una transacción que se confirma.
 */
export async function asUser<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("set local role authenticated");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}
