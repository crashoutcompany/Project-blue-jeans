import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/credentials/google-ai-studio", () => ({
  getGoogleAiStudioSettings: vi.fn(),
  saveGoogleAiStudioByok: vi.fn(),
  revokeGoogleAiStudioByok: vi.fn(),
}));

vi.mock("@/lib/credentials/uploadthing", () => ({
  getUploadThingSettings: vi.fn(),
  saveUploadThingByok: vi.fn(),
  revokeUploadThingByok: vi.fn(),
}));

vi.mock("@/lib/media/seal-legacy", () => ({
  sealLegacyUploadThingMedia: vi.fn().mockResolvedValue(undefined),
}));

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  getGoogleAiStudioSettings,
  revokeGoogleAiStudioByok,
  saveGoogleAiStudioByok,
} from "@/lib/credentials/google-ai-studio";
import {
  getUploadThingSettings,
  revokeUploadThingByok,
  saveUploadThingByok,
} from "@/lib/credentials/uploadthing";
import { GET } from "@/app/api/settings/providers/route";
import {
  PUT,
} from "@/app/api/settings/providers/google-ai-studio/route";
import {
  DELETE as DELETE_UPLOADTHING,
  PUT as PUT_UPLOADTHING,
} from "@/app/api/settings/providers/uploadthing/route";

const admitted = vi.mocked(assertAdmittedSession);
const getGoogleSettings = vi.mocked(getGoogleAiStudioSettings);
const getUploadSettings = vi.mocked(getUploadThingSettings);
const saveGoogleMock = vi.mocked(saveGoogleAiStudioByok);
const revokeGoogleMock = vi.mocked(revokeGoogleAiStudioByok);
const saveUploadMock = vi.mocked(saveUploadThingByok);
const revokeUploadMock = vi.mocked(revokeUploadThingByok);

const wearerGate = {
  ok: true as const,
  userId: "wearer-1",
  membership: {
    userId: "wearer-1",
    accessRole: "wearer" as const,
    credentialSource: "user_byok" as const,
    status: "active" as const,
    persisted: true,
  },
};

const ownerGate = {
  ok: true as const,
  userId: "owner-1",
  membership: {
    userId: "owner-1",
    accessRole: "owner" as const,
    credentialSource: "platform_env" as const,
    status: "active" as const,
    persisted: true,
  },
};

describe("settings provider routes", () => {
  beforeEach(() => {
    admitted.mockReset();
    getGoogleSettings.mockReset();
    getUploadSettings.mockReset();
    saveGoogleMock.mockReset();
    revokeGoogleMock.mockReset();
    saveUploadMock.mockReset();
    revokeUploadMock.mockReset();
  });

  it("GET returns 401 when signed out", async () => {
    admitted.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Sign in to continue.",
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns public provider status without secrets", async () => {
    admitted.mockResolvedValue(wearerGate);
    getGoogleSettings.mockResolvedValue({
      funding: "byok",
      canEdit: true,
      connected: true,
      secretHint: "…1234",
      testedAt: "2026-08-18T12:00:00.000Z",
    });
    getUploadSettings.mockResolvedValue({
      funding: "byok",
      canEdit: true,
      connected: true,
      secretHint: "…5678",
      testedAt: "2026-08-18T12:00:00.000Z",
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.googleAiStudio.secretHint).toBe("…1234");
    expect(body.uploadthing.secretHint).toBe("…5678");
    expect(JSON.stringify(body)).not.toContain("AIza");
    expect(JSON.stringify(body)).not.toContain("sk_live");
  });

  it("PUT returns 409 when the owner tries to save a BYOK key", async () => {
    admitted.mockResolvedValue(ownerGate);
    saveGoogleMock.mockResolvedValue({
      ok: false,
      message:
        "Platform-funded accounts use the environment Google AI Studio key.",
    });

    const res = await PUT(
      new Request("http://localhost/api/settings/providers/google-ai-studio", {
        method: "PUT",
        body: JSON.stringify({ apiKey: "AIza-owner" }),
      }),
    );
    expect(res.status).toBe(409);
    expect(saveGoogleMock).toHaveBeenCalled();
  });

  it("PUT saves a Wearer UploadThing token after validation", async () => {
    admitted.mockResolvedValue(wearerGate);
    saveUploadMock.mockResolvedValue({ ok: true, secretHint: "…5678" });

    const res = await PUT_UPLOADTHING(
      new Request("http://localhost/api/settings/providers/uploadthing", {
        method: "PUT",
        body: JSON.stringify({ token: "wearer-upload-token-5678" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(saveUploadMock).toHaveBeenCalledWith(
      "wearer-1",
      wearerGate.membership,
      "wearer-upload-token-5678",
    );
  });

  it("DELETE returns 409 for a platform-funded owner UploadThing disconnect", async () => {
    admitted.mockResolvedValue(ownerGate);
    revokeUploadMock.mockResolvedValue({
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    });

    const res = await DELETE_UPLOADTHING();
    expect(res.status).toBe(409);
  });
});
