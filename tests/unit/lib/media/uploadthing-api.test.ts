import { describe, expect, it } from "vitest";

import { publicUploadThingFileUrl } from "@/lib/media/uploadthing-api";

function tokenFor(appId: string): string {
  return Buffer.from(
    JSON.stringify({ apiKey: "sk_live_test", appId, regions: ["sea1"] }),
  ).toString("base64");
}

describe("publicUploadThingFileUrl", () => {
  it("decodes the app id from the token", () => {
    expect(publicUploadThingFileUrl(tokenFor("tcsdez3brx"), "fileKey1")).toBe(
      "https://tcsdez3brx.ufs.sh/f/fileKey1",
    );
  });

  it("throws when the token has no app id", () => {
    const token = Buffer.from(JSON.stringify({ apiKey: "sk_live_test" })).toString(
      "base64",
    );
    expect(() => publicUploadThingFileUrl(token, "fileKey1")).toThrow(
      "UploadThing token is missing an app id.",
    );
  });
});
