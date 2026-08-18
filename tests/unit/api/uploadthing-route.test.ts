import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingToken: vi.fn(),
}));

vi.mock("uploadthing/next", () => ({
  createRouteHandler: vi.fn(),
}));

vi.mock("@/app/api/uploadthing/core", () => ({
  ourFileRouter: {},
}));

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { createRouteHandler } from "uploadthing/next";
import { POST } from "@/app/api/uploadthing/route";

const admitted = vi.mocked(assertAdmittedSession);
const resolveToken = vi.mocked(resolveUploadThingToken);
const createHandler = vi.mocked(createRouteHandler);

describe("POST /api/uploadthing", () => {
  beforeEach(() => {
    admitted.mockReset();
    resolveToken.mockReset();
    createHandler.mockReset();
    createHandler.mockReturnValue({
      GET: vi.fn(),
      POST: vi.fn(async () => new Response("ok")),
    } as never);
  });

  it("does not require a session for UploadThing callbacks", async () => {
    resolveToken.mockResolvedValue({
      ok: true,
      token: "wearer-token",
      connectionId: "c1",
      source: "user_byok",
    });
    const res = await POST(
      new Request("http://localhost/api/uploadthing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "uploadthing-hook": "callback",
        },
        body: JSON.stringify({
          status: "uploaded",
          metadata: { userId: "u1" },
          file: { key: "file-a" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(admitted).not.toHaveBeenCalled();
    expect(createHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { token: "wearer-token" },
      }),
    );
  });

  it("still requires admission for browser uploads", async () => {
    admitted.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Sign in to continue.",
    });
    const res = await POST(
      new Request("http://localhost/api/uploadthing", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
    expect(createHandler).not.toHaveBeenCalled();
  });
});
