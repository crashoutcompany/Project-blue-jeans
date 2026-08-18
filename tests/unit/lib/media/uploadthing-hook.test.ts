import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingToken: vi.fn(),
}));

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import {
  isUploadThingServerHook,
  resolveUploadThingHookToken,
} from "@/lib/media/uploadthing-hook";

const resolveToken = vi.mocked(resolveUploadThingToken);

describe("isUploadThingServerHook", () => {
  it("detects callback and error hooks", () => {
    expect(
      isUploadThingServerHook(
        new Request("http://localhost/api/uploadthing", {
          method: "POST",
          headers: { "uploadthing-hook": "callback" },
        }),
      ),
    ).toBe(true);
    expect(
      isUploadThingServerHook(
        new Request("http://localhost/api/uploadthing", {
          method: "POST",
          headers: { "uploadthing-hook": "error" },
        }),
      ),
    ).toBe(true);
  });

  it("ignores browser upload POSTs", () => {
    expect(
      isUploadThingServerHook(
        new Request("http://localhost/api/uploadthing?actionType=upload", {
          method: "POST",
        }),
      ),
    ).toBe(false);
  });
});

describe("resolveUploadThingHookToken", () => {
  it("resolves the Wearer token from callback metadata", async () => {
    resolveToken.mockResolvedValue({
      ok: true,
      token: "wearer-token",
      connectionId: "c1",
      source: "user_byok",
    });
    const request = new Request("http://localhost/api/uploadthing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "uploadthing-hook": "callback",
      },
      body: JSON.stringify({
        status: "uploaded",
        metadata: { userId: "u1", intentId: "intent-1" },
        file: { key: "file-a" },
      }),
    });

    await expect(resolveUploadThingHookToken(request)).resolves.toEqual({
      ok: true,
      token: "wearer-token",
    });
    expect(resolveToken).toHaveBeenCalledWith("u1");
  });
});
