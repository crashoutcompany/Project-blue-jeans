import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The image-compression worker bundle is served from /public/vendor so the CSP
 * does not need cdn.jsdelivr.net. After upgrading browser-image-compression,
 * refresh it with:
 *   cp node_modules/browser-image-compression/dist/browser-image-compression.js public/vendor/
 */
describe("vendored browser-image-compression worker", () => {
  it("matches the installed package", () => {
    const root = process.cwd();
    const vendored = readFileSync(
      path.join(root, "public/vendor/browser-image-compression.js"),
    );
    const installed = readFileSync(
      path.join(
        root,
        "node_modules/browser-image-compression/dist/browser-image-compression.js",
      ),
    );
    expect(vendored.equals(installed)).toBe(true);
  });
});
