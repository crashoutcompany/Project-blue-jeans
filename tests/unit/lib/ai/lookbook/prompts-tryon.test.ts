import { describe, expect, it } from "vitest";

import {
  STEP2_TRYON_SYSTEM,
  step2TryOnUserPrompt,
} from "@/lib/ai/lookbook/prompts";

describe("try-on hero prompts", () => {
  it("mentions wearer identity and garments", () => {
    expect(STEP2_TRYON_SYSTEM.toLowerCase()).toContain("wearer");
    const prompt = step2TryOnUserPrompt({
      title: "Navy set",
      description: "Clean layers",
      climate: "Cool",
      context: "Office",
      narrative: "",
      garmentSummary: "top, bottom",
    });
    expect(prompt.toLowerCase()).toContain("try-on");
    expect(prompt).toContain("Navy set");
  });
});
