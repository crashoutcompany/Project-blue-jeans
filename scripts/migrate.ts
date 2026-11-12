#!/usr/bin/env tsx
/**
 * Apply db/schema.sql, then every db/migrations/*.sql not yet recorded in
 * `schema_migrations`, in file-name order, each in its own transaction.
 *
 *   pnpm db:migrate            apply
 *   pnpm db:migrate --dry-run  list what would run; writes nothing
 *
 * db/schema.sql is idempotent and always re-applied (it creates what is
 * missing). Migrations are one-off changes to existing tables and must be safe
 * to re-run, because branches that had them applied by hand have no record yet.
 *
 * Connects with DATABASE_URL_UNPOOLED when set (Neon's direct URL), otherwise
 * DATABASE_URL. Whatever URL it is given is the database it changes, so check
 * the target before running it by hand.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@neondatabase/serverless";

export type MigrateClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type Options = {
  dryRun: boolean;
  dbDir: string;
  log: (message: string) => void;
};

/** Arbitrary constant: serializes concurrent runs (builds, CI) on one database. */
const LOCK_KEY = 7_361_029_145;

const SCHEMA_FILE = "schema.sql";

async function transaction(
  client: MigrateClient,
  work: () => Promise<void>,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
    await work();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function migrationFiles(dbDir: string): Promise<string[]> {
  const entries = await readdir(path.join(dbDir, "migrations")).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [] as string[];
      throw error;
    },
  );
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

export async function runMigrations(
  client: MigrateClient,
  { dryRun, dbDir, log }: Options,
): Promise<string[]> {
  const files = await migrationFiles(dbDir);

  const table = await client.query(
    "SELECT to_regclass('schema_migrations') AS name",
  );
  const hasTable = (table.rows[0] as { name: string | null }).name !== null;
  const recorded = new Set<string>();
  if (hasTable) {
    const result = await client.query("SELECT name FROM schema_migrations");
    for (const row of result.rows as { name: string }[]) recorded.add(row.name);
  }
  const pending = files.filter((name) => !recorded.has(name));

  if (dryRun) {
    log(`dry run: ${SCHEMA_FILE} would be applied (idempotent)`);
    log(
      pending.length
        ? `dry run: ${pending.length} pending migration(s):\n${pending.map((n) => `  ${n}`).join("\n")}`
        : "dry run: no pending migrations",
    );
    return pending;
  }

  await transaction(client, async () => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await client.query(await readFile(path.join(dbDir, SCHEMA_FILE), "utf8"));
  });
  log(`applied ${SCHEMA_FILE}`);

  const applied: string[] = [];
  for (const name of pending) {
    const sql = await readFile(path.join(dbDir, "migrations", name), "utf8");
    await transaction(client, async () => {
      // Another runner may have applied it while we waited for the lock.
      const done = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [name],
      );
      if (done.rows.length > 0) return;
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        name,
      ]);
      applied.push(name);
    });
    log(`applied migration ${name}`);
  }
  if (pending.length === 0) log("no pending migrations");
  return applied;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required");
    process.exit(1);
  }

  const client = new Client(url);
  await client.connect();
  try {
    await runMigrations(client, {
      dryRun,
      dbDir: path.join(process.cwd(), "db"),
      log: (message) => console.log(`[migrate] ${message}`),
    });
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
