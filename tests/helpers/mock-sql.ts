import { vi } from "vitest";

export type SqlCall = {
  strings: TemplateStringsArray;
  values: unknown[];
};

/**
 * Minimal tagged-template mock for `@neondatabase/serverless` `neon()` sql client.
 */
export function createMockSql(
  handler?: (call: SqlCall) => Promise<unknown> | unknown,
) {
  const calls: SqlCall[] = [];

  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const call: SqlCall = { strings, values };
      calls.push(call);
      if (handler) return Promise.resolve(handler(call));
      return Promise.resolve([]);
    },
    {
      /** Neon client may expose transaction helpers; tests rarely need them. */
    },
  );

  return { sql, calls };
}

export function viRequireSql(sql: ReturnType<typeof createMockSql>["sql"]) {
  return vi.fn().mockReturnValue(sql);
}
