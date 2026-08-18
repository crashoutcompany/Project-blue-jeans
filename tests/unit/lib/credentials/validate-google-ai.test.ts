import { afterEach, describe, expect, it, vi } from "vitest";

import { validateGoogleAiStudioApiKey } from "@/lib/credentials/validate-google-ai";

describe("validateGoogleAiStudioApiKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a key when Google returns models metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateGoogleAiStudioApiKey(' "AIza-test-key" '),
    ).resolves.toEqual({ ok: true, apiKey: "AIza-test-key" });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["x-goog-api-key"]).toBe("AIza-test-key");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("AIza-test-key");
  });

  it("returns a generic error for an invalid key without Google's body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "API_KEY_INVALID secret",
      }),
    );

    const result = await validateGoogleAiStudioApiKey("AIza-bad-key");
    expect(result).toEqual({
      ok: false,
      message: "That Google AI Studio key could not be verified.",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
