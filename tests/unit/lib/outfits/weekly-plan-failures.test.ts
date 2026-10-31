import { describe, expect, it } from "vitest";

import {
  parseFailedPlanDays,
  withFailedPlanDay,
} from "@/lib/outfits/weekly-plan-failures";

describe("parseFailedPlanDays", () => {
  it("reads failedDays from step1_raw", () => {
    expect(
      parseFailedPlanDays({
        plans: [],
        failedDays: [{ sortOrder: 5, message: "Couldn't plan Friday." }],
      }),
    ).toEqual([{ sortOrder: 5, message: "Couldn't plan Friday." }]);
  });

  it("treats plans saved before partial weeks, or malformed data, as none", () => {
    expect(parseFailedPlanDays(null)).toEqual([]);
    expect(parseFailedPlanDays({ plans: [] })).toEqual([]);
    expect(parseFailedPlanDays({ failedDays: [{ sortOrder: 9 }] })).toEqual([]);
  });
});

describe("withFailedPlanDay", () => {
  const days = [
    { sortOrder: 2, message: "Couldn't plan Tuesday." },
    { sortOrder: 5, message: "Couldn't plan Friday." },
  ];

  it("replaces one day's failure and keeps the order", () => {
    expect(withFailedPlanDay(days, 3, "Couldn't plan Wednesday.")).toEqual([
      days[0],
      { sortOrder: 3, message: "Couldn't plan Wednesday." },
      days[1],
    ]);
    expect(withFailedPlanDay(days, 5, "Again.")).toEqual([
      days[0],
      { sortOrder: 5, message: "Again." },
    ]);
  });

  it("clears a day", () => {
    expect(withFailedPlanDay(days, 2, null)).toEqual([days[1]]);
  });
});
