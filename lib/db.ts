import { neon } from "@neondatabase/serverless";

type NeonSql = ReturnType<typeof neon>;

let sql: NeonSql | undefined;
let attempted = false;

/**
 * Neon serverless SQL (HTTP). Returns `undefined` if `DATABASE_URL` is unset
 * (e.g. CI/build without secrets).
 */
export function getSql(): NeonSql | undefined {
  if (attempted) return sql;
  attempted = true;
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  sql = neon(url);
  return sql;
}

/** Use when the database is required; throws with a clear message if misconfigured. */
export function requireSql(): NeonSql {
  const client = getSql();
  if (!client) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local (Neon dashboard → Connect)."
    );
  }
  return client;
}
