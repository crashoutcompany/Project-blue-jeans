import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getAuthoritativeSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

vi.mock("@/lib/generation-rate-limit", () => ({
  consumeGeneration: vi.fn(),
}));

vi.mock("@/lib/lookbook/generate-lookbook", () => ({
  generateLookbook: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { consumeGeneration } from "@/lib/generation-rate-limit";
import { generateLookbook } from "@/lib/lookbook/generate-lookbook";
import { POST } from "@/app/api/generate-lookbook/route";

const getSession = vi.mocked(auth.getAuthoritativeSession);
const getSqlMock = vi.mocked(getSql);
const consumeMock = vi.mocked(consumeGeneration);
const generateLookbookMock = vi.mocked(generateLookbook);

describe("POST /api/generate-lookbook", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSession.mockReset();
    generateLookbookMock.mockReset();
    consumeMock.mockReset();
    consumeMock.mockResolvedValue({ allowed: true });
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

  it("returns 401 when not signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({ narrative: "x" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when signed in but not admitted", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({ narrative: "x" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 429 at the generation limit without generating", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    consumeMock.mockResolvedValue({ allowed: false, message: "Slow down." });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({ narrative: "x" }),
      }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, message: "Slow down." });
    expect(generateLookbookMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when narrative missing", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("calls generateLookbook for an admitted session", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    generateLookbookMock.mockResolvedValue({
      ok: true,
      looks: [],
      curatorNote: "note",
    });
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({ narrative: "Summer brunch" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(generateLookbookMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", narrative: "Summer brunch" }),
    );
  });

  it("fails with 500 and a safe message when generateLookbook throws", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    generateLookbookMock.mockRejectedValue(
      new Error("PROVIDER_CREDENTIAL_KEY_V2 is not configured."),
    );
    const res = await POST(
      new Request("http://localhost/api/generate-lookbook", {
        method: "POST",
        body: JSON.stringify({ narrative: "Summer brunch" }),
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      message: "We could not generate your lookbook. Try again in a moment.",
    });
  });
});
