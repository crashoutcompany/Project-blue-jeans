import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { GET } from "@/app/api/db/ping/route";

const getSession = vi.mocked(auth.getSession);
const getSqlMock = vi.mocked(getSql);

describe("GET /api/db/ping", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSession.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
    delete process.env.APP_OWNER_USER_ID;
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  it("returns 401 when getSession throws", async () => {
    getSession.mockRejectedValue(new Error("auth down"));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when not signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admitted", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 503 when DATABASE_URL missing", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    getSqlMock.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns 200 when SELECT 1 succeeds", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ok: 1 }]);
    getSqlMock.mockReturnValue(sql as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalled();
  });
});
