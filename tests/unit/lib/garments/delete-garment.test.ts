import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/uploadthing-server", () => ({
  deleteUploadThingFiles: vi.fn(),
}));

import { requireSql } from "@/lib/db";
import { deleteGarment } from "@/lib/garments/delete-garment";
import { deleteUploadThingFiles } from "@/lib/uploadthing-server";

const requireSqlMock = vi.mocked(requireSql);
const deleteFilesMock = vi.mocked(deleteUploadThingFiles);

const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function sqlText(strings: TemplateStringsArray) {
  return strings.join(" ");
}

function mockSql(handler: (text: string) => unknown) {
  const sql = Object.assign(
    vi.fn((strings: TemplateStringsArray) =>
      Promise.resolve(handler(sqlText(strings))),
    ),
    {
      transaction: vi.fn(async (queries: Promise<unknown>[]) => {
        const results: unknown[] = [];
        for (const query of queries) {
          results.push(await query);
        }
        return results;
      }),
    },
  );
  return sql;
}

describe("deleteGarment", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
    deleteFilesMock.mockReset();
    deleteFilesMock.mockResolvedValue(undefined);
  });

  it("rejects invalid ids", async () => {
    const res = await deleteGarment("u1", "pending:abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Invalid");
    expect(requireSqlMock).not.toHaveBeenCalled();
  });

  it("returns not found when the row is missing", async () => {
    const sql = mockSql(() => []);
    requireSqlMock.mockReturnValue(sql as never);
    const res = await deleteGarment("u1", gid);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("not found");
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("commits closet deletes in one transaction before UploadThing", async () => {
    let transactionFinished = false;
    const sql = mockSql((text) => {
      if (text.includes("uploadthing_key")) {
        return [{ uploadthing_key: "file-key" }];
      }
      if (text.includes("DELETE FROM garments")) {
        return [{ id: gid }];
      }
      return [];
    });
    sql.transaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      const results: unknown[] = [];
      for (const query of queries) {
        results.push(await query);
      }
      transactionFinished = true;
      return results;
    });
    deleteFilesMock.mockImplementation(async () => {
      expect(transactionFinished).toBe(true);
    });
    requireSqlMock.mockReturnValue(sql as never);

    const res = await deleteGarment("u1", gid);
    expect(res.ok).toBe(true);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(deleteFilesMock).toHaveBeenCalledWith(["file-key"]);

    const sent = sql.mock.calls.map((call) => sqlText(call[0])).join("\n");
    expect(sent).toMatch(/DELETE FROM outfit_garments/i);
    expect(sent).toMatch(/DELETE FROM garments/i);
    expect(sent).toMatch(/garment_set_key/);
  });

  it("skips UploadThing when there is no key", async () => {
    const sql = mockSql((text) => {
      if (text.includes("uploadthing_key")) {
        return [{ uploadthing_key: null }];
      }
      if (text.includes("DELETE FROM garments")) {
        return [{ id: gid }];
      }
      return [];
    });
    requireSqlMock.mockReturnValue(sql as never);

    const res = await deleteGarment("u1", gid);
    expect(res.ok).toBe(true);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("does not delete the photo if the transaction fails", async () => {
    const sql = mockSql(() => []);
    sql.transaction.mockRejectedValue(new Error("db down"));
    requireSqlMock.mockReturnValue(sql as never);

    const res = await deleteGarment("u1", gid);
    expect(res.ok).toBe(false);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });
});
