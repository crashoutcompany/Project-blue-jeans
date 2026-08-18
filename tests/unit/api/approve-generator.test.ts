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

vi.mock("@/lib/outfits/persist-generator-outfit", async (orig) => {
  const actual =
    await orig<typeof import("@/lib/outfits/persist-generator-outfit")>();
  return {
    ...actual,
    executeApproveGeneratorOutfit: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { executeApproveGeneratorOutfit } from "@/lib/outfits/persist-generator-outfit";
import { POST } from "@/app/api/outfits/approve-generator/route";

const getSession = vi.mocked(auth.getSession);
const getSqlMock = vi.mocked(getSql);
const approveMock = vi.mocked(executeApproveGeneratorOutfit);

describe("POST /api/outfits/approve-generator", () => {
  /** Valid RFC-4122-style UUID accepted by Zod `uuid()` */
  const uuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  beforeEach(() => {
    getSession.mockReset();
    approveMock.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
  });

  it("returns 401 when not signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const res = await POST(
      new Request("http://localhost/api/outfits/approve-generator", {
        method: "POST",
        body: JSON.stringify({
          wornOn: "2025-01-01",
          garmentIds: [uuid],
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admitted", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await POST(
      new Request("http://localhost/api/outfits/approve-generator", {
        method: "POST",
        body: JSON.stringify({
          wornOn: "2025-01-01",
          garmentIds: [uuid],
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when payload invalid", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const res = await POST(
      new Request("http://localhost/api/outfits/approve-generator", {
        method: "POST",
        body: JSON.stringify({ wornOn: "bad" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 when approve succeeds", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    approveMock.mockResolvedValue({ ok: true, outfitId: uuid });
    const res = await POST(
      new Request("http://localhost/api/outfits/approve-generator", {
        method: "POST",
        body: JSON.stringify({
          wornOn: "2025-01-15",
          garmentIds: [uuid],
          occasion: "casual",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(approveMock).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ wornOn: "2025-01-15" }),
    );
  });

  it("returns 422 when approve returns failure", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    approveMock.mockResolvedValue({ ok: false, message: "missing" });
    const res = await POST(
      new Request("http://localhost/api/outfits/approve-generator", {
        method: "POST",
        body: JSON.stringify({
          wornOn: "2025-01-15",
          garmentIds: [uuid],
        }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
