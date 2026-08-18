import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

vi.mock("@/lib/lookbook/generate-lookbook", () => ({
  generateLookbook: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { generateLookbook } from "@/lib/lookbook/generate-lookbook";
import { POST } from "@/app/api/generate-lookbook/route";

const getSession = vi.mocked(auth.getSession);
const getSqlMock = vi.mocked(getSql);
const generateLookbookMock = vi.mocked(generateLookbook);

describe("POST /api/generate-lookbook", () => {
  beforeEach(() => {
    getSession.mockReset();
    generateLookbookMock.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
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

  it("returns 400 for invalid JSON", async () => {
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

  it("returns a structured error when generateLookbook throws", async () => {
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
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      message: "We could not generate your lookbook. Try again in a moment.",
    });
  });
});
