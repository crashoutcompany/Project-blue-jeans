import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveUploadThingToken: vi.fn(),
  resolveUploadThingTokenForConnection: vi.fn(),
  uploadThingEnvToken: vi.fn(),
}));

vi.mock("@/lib/media/intents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/media/intents")>();
  return {
    ...actual,
    getUploadIntentById: vi.fn(),
  };
});

import { resolveUploadThingToken, uploadThingEnvToken } from "@/lib/credentials/resolve";
import { getUploadIntentById } from "@/lib/media/intents";
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
  beforeEach(() => {
    resolveToken.mockReset();
    vi.mocked(uploadThingEnvToken).mockReset();
    vi.mocked(getUploadIntentById).mockReset();
  });

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

  it("uses the platform token for error hooks without metadata.userId", async () => {
    vi.mocked(uploadThingEnvToken).mockReturnValue("platform-token");
    const request = new Request("http://localhost/api/uploadthing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "uploadthing-hook": "error",
      },
      body: JSON.stringify({ status: "failed", file: { key: "file-a" } }),
    });

    await expect(resolveUploadThingHookToken(request)).resolves.toEqual({
      ok: true,
      token: "platform-token",
    });
    expect(resolveToken).not.toHaveBeenCalled();
  });

  it("resolves an error hook from the signed intent id", async () => {
    vi.mocked(getUploadIntentById).mockResolvedValue({
      userId: "u1",
      connectionId: "c1",
    });
    const { resolveUploadThingTokenForConnection } = await import(
      "@/lib/credentials/resolve"
    );
    vi.mocked(resolveUploadThingTokenForConnection).mockResolvedValue({
      ok: true,
      token: "intent-token",
      connectionId: "c1",
      source: "user_byok",
    });

    const request = new Request("http://localhost/api/uploadthing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "uploadthing-hook": "error",
      },
      body: JSON.stringify({
        status: "failed",
        metadata: { intentId: "intent-1" },
      }),
    });

    await expect(resolveUploadThingHookToken(request)).resolves.toEqual({
      ok: true,
      token: "intent-token",
    });
  });

  it("does not fall back to the platform token when a Wearer intent cannot resolve", async () => {
    vi.mocked(getUploadIntentById).mockResolvedValue({
      userId: "u1",
      connectionId: "c1",
    });
    const { resolveUploadThingTokenForConnection } = await import(
      "@/lib/credentials/resolve"
    );
    vi.mocked(resolveUploadThingTokenForConnection).mockResolvedValue({
      ok: false,
      message: "Connect UploadThing in Settings before uploading photos.",
    });
    vi.mocked(uploadThingEnvToken).mockReturnValue("platform-token");

    const request = new Request("http://localhost/api/uploadthing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "uploadthing-hook": "error",
      },
      body: JSON.stringify({
        status: "failed",
        metadata: { intentId: "intent-1" },
      }),
    });

    await expect(resolveUploadThingHookToken(request)).resolves.toEqual({
      ok: false,
      message: "Connect UploadThing in Settings before uploading photos.",
    });
    expect(uploadThingEnvToken).not.toHaveBeenCalled();
  });

  it("does not use the platform token for callback hooks without a Wearer", async () => {
    vi.mocked(uploadThingEnvToken).mockReturnValue("platform-token");
    const request = new Request("http://localhost/api/uploadthing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "uploadthing-hook": "callback",
      },
      body: JSON.stringify({ status: "uploaded", file: { key: "file-a" } }),
    });

    await expect(resolveUploadThingHookToken(request)).resolves.toEqual({
      ok: false,
      message: "UploadThing callback is missing a Wearer.",
    });
  });
});
