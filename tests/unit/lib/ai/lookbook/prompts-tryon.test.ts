import { describe, expect, it } from "vitest";

import {
  STEP2_SYSTEM,
  STEP2_TRYON_SYSTEM,
  step1UserPrompt,
  step2TryOnUserPrompt,
  step2UserPrompt,
} from "@/lib/ai/lookbook/prompts";

const sampleLook = {
  title: "Navy set",
  description: "Clean layers",
  climate: "Cool",
  context: "Office",
  narrative: "",
  garmentSummary: "top, bottom",
};

describe("try-on hero prompts", () => {
  it("mentions wearer identity and garments", () => {
    expect(STEP2_TRYON_SYSTEM.toLowerCase()).toContain("wearer");
    const prompt = step2TryOnUserPrompt(sampleLook);
    expect(prompt.toLowerCase()).toContain("try-on");
    expect(prompt).toContain("Navy set");
  });
});

describe("studio photoshoot backdrop", () => {
  it("asks editorial and try-on heroes for a solid studio backdrop", () => {
    expect(STEP2_SYSTEM.toLowerCase()).toMatch(/solid/);
    expect(STEP2_TRYON_SYSTEM.toLowerCase()).toMatch(/solid/);

    const editorial = step2UserPrompt(sampleLook).toLowerCase();
    const tryOn = step2TryOnUserPrompt(sampleLook).toLowerCase();

    expect(editorial).toMatch(/photoshoot/);
    expect(editorial).toMatch(/solid/);
    expect(tryOn).toMatch(/photoshoot/);
    expect(tryOn).toMatch(/solid/);
    expect(tryOn).not.toMatch(/natural light/);
  });
});

describe("weekly sequential step-1 prompt", () => {
  it("names the weekday and lists already-planned looks", () => {
    const prompt = step1UserPrompt({
      lookCount: 1,
      climate: "Temperate",
      context: "Everyday week",
      narrative: "",
      catalogText:
        "- **id-1** | tops | Tee | color: — | desc: (no description) | notes: —",
      weekly: true,
      weeklyWeekday: "Friday",
      alreadyPlanned: [
        {
          weekday: "Thursday",
          title: "Office polo",
          garmentNames: ["Polo", "Grey trousers"],
        },
      ],
    });

    expect(prompt).toContain("**Friday**");
    expect(prompt).toContain("one day");
    expect(prompt).toContain("Thursday — Office polo (Polo, Grey trousers)");
    expect(prompt).not.toContain("Monday (index 0)");
  });
});
