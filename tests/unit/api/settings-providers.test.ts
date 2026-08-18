import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/credentials/google-ai-studio", () => ({
  getGoogleAiStudioSettings: vi.fn(),
  saveGoogleAiStudioByok: vi.fn(),
  revokeGoogleAiStudioByok: vi.fn(),
}));

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  getGoogleAiStudioSettings,
  revokeGoogleAiStudioByok,
  saveGoogleAiStudioByok,
} from "@/lib/credentials/google-ai-studio";
import { GET } from "@/app/api/settings/providers/route";
import {
  DELETE,
  PUT,
} from "@/app/api/settings/providers/google-ai-studio/route";

const admitted = vi.mocked(assertAdmittedSession);
const getSettings = vi.mocked(getGoogleAiStudioSettings);
const saveMock = vi.mocked(saveGoogleAiStudioByok);
const revokeMock = vi.mocked(revokeGoogleAiStudioByok);

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
    getSettings.mockReset();
    saveMock.mockReset();
    revokeMock.mockReset();
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

  it("GET returns public Google AI Studio status without a secret", async () => {
    admitted.mockResolvedValue(wearerGate);
    getSettings.mockResolvedValue({
      funding: "byok",
      canEdit: true,
      connected: true,
      secretHint: "…1234",
      testedAt: "2026-08-18T12:00:00.000Z",
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.googleAiStudio.secretHint).toBe("…1234");
    expect(JSON.stringify(body)).not.toContain("AIza");
  });

  it("PUT returns 409 when the owner tries to save a BYOK key", async () => {
    admitted.mockResolvedValue(ownerGate);
    saveMock.mockResolvedValue({
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
    expect(saveMock).toHaveBeenCalled();
  });

  it("PUT saves a Wearer key after validation", async () => {
    admitted.mockResolvedValue(wearerGate);
    saveMock.mockResolvedValue({ ok: true, secretHint: "…1234" });

    const res = await PUT(
      new Request("http://localhost/api/settings/providers/google-ai-studio", {
        method: "PUT",
        body: JSON.stringify({ apiKey: "AIza-wearer-key-1234" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(
      "wearer-1",
      wearerGate.membership,
      "AIza-wearer-key-1234",
    );
  });

  it("DELETE returns 409 for a platform-funded owner", async () => {
    admitted.mockResolvedValue(ownerGate);
    revokeMock.mockResolvedValue({
      ok: false,
      message:
        "Platform-funded accounts use the environment Google AI Studio key.",
    });

    const res = await DELETE();
    expect(res.status).toBe(409);
  });
});
