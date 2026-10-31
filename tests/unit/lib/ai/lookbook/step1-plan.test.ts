import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

type LanguageModelV3GenerateResult = Awaited<
  ReturnType<MockLanguageModelV3["doGenerate"]>
>;
type LanguageModelV3Content = LanguageModelV3GenerateResult["content"][number];

const { model } = vi.hoisted(() => ({
  model: { current: undefined as unknown },
}));

vi.mock("@/lib/ai/gemini-provider", () => ({
  geminiModel: () => model.current,
}));

vi.mock("@/lib/ai/weather/fetch-weather", () => ({
  fetchWeather: vi.fn(async () => ({ ok: true, summary: "12°C, light rain" })),
}));

import { OutfitPlanError } from "@/lib/ai/lookbook/plan-error";
import { LOOK_LIMITS } from "@/lib/ai/lookbook/schemas";
import {
  extractJsonObject,
  runOutfitPlanStep,
} from "@/lib/ai/lookbook/step1-plan";

const TOP = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const BOTTOM = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const SHOE = "e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

const params = {
  apiKey: "key",
  lookCount: 1,
  climate: "Temperate",
  context: "Everyday week",
  narrative: "",
  catalogText: "catalog",
  location: "New York, NY",
  weekly: true,
  weeklyWeekday: "Friday",
};

function reply(
  content: LanguageModelV3Content[],
  finish: "stop" | "tool-calls" | "length" = "stop",
): LanguageModelV3GenerateResult {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage: {
      inputTokens: {
        total: 10,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 10, text: undefined, reasoning: undefined },
    },
    warnings: [],
  };
}

const textReply = (text: string) => reply([{ type: "text", text }]);

const weatherCall = (id: string) =>
  reply(
    [
      {
        type: "tool-call",
        toolCallId: id,
        toolName: "getWeather",
        input: JSON.stringify({ location: "New York, NY" }),
      },
    ],
    "tool-calls",
  );

const look = {
  title: "Rainy Friday",
  description: "Layered and dry.",
  tags: ["rain"],
  garmentIds: [TOP, BOTTOM, SHOE],
};

function useModel(doGenerate: LanguageModelV3GenerateResult[]) {
  const mock = new MockLanguageModelV3({ doGenerate });
  model.current = mock;
  return mock;
}

describe("runOutfitPlanStep", () => {
  beforeEach(() => {
    model.current = undefined;
  });

  it("accepts a reply that breaks limits Gemini never sees, then clips it", async () => {
    // Gemini drops maxLength / maxItems from the schema, so replies like this
    // one reach Zod and used to fail with AI_NoObjectGeneratedError.
    useModel([
      textReply(
        JSON.stringify({
          looks: [
            {
              title: "T".repeat(200),
              description: "D".repeat(900),
              tags: ["#rain", "Rain", "office", "layers", "navy", "denim", "cozy"],
              garmentIds: [TOP, BOTTOM, SHOE, TOP],
            },
          ],
          curatorNote: null,
        }),
      ),
    ]);

    const plan = await runOutfitPlanStep(params);

    expect(plan.curatorNote).toBeUndefined();
    const [first] = plan.looks;
    expect(first?.title).toHaveLength(LOOK_LIMITS.title);
    expect(first?.description).toHaveLength(LOOK_LIMITS.description);
    expect(first?.tags).toEqual(["rain", "office", "layers", "navy", "denim"]);
    expect(first?.garmentIds).toEqual([TOP, BOTTOM, SHOE]);
  });

  it("keeps a non-uuid garment id for the closet filter instead of failing the parse", async () => {
    useModel([
      textReply(
        JSON.stringify({ looks: [{ ...look, garmentIds: [TOP, "top-1"] }] }),
      ),
    ]);

    const plan = await runOutfitPlanStep(params);

    expect(plan.looks[0]?.garmentIds).toEqual([TOP, "top-1"]);
  });

  it("salvages JSON wrapped in prose and a code fence", async () => {
    useModel([
      textReply(
        "Here is your outfit:\n```json\n" +
          JSON.stringify({ looks: [look] }) +
          "\n```\nEnjoy!",
      ),
    ]);

    const plan = await runOutfitPlanStep(params);

    expect(plan.looks).toEqual([look]);
  });

  it("throws OutfitPlanError when the reply is prose", async () => {
    useModel([textReply("I recommend the navy polo with grey trousers.")]);

    const error = await runOutfitPlanStep(params).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OutfitPlanError);
    expect((error as OutfitPlanError).reason).toBe("no-object");
    expect((error as OutfitPlanError).message).toMatch(/finishReason=stop/);
  });

  it("throws OutfitPlanError when JSON is cut off at the token limit", async () => {
    useModel([
      reply(
        [{ type: "text", text: '{"looks":[{"title":"Rainy' }],
        "length",
      ),
    ]);

    const error = await runOutfitPlanStep(params).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OutfitPlanError);
    expect((error as OutfitPlanError).message).toMatch(/finishReason=length/);
  });

  it("throws OutfitPlanError when the reply has too few looks", async () => {
    useModel([textReply(JSON.stringify({ looks: [] }))]);

    await expect(runOutfitPlanStep(params)).rejects.toBeInstanceOf(
      OutfitPlanError,
    );
  });

  it("calls getWeather, then answers", async () => {
    const mock = useModel([
      weatherCall("w1"),
      textReply(JSON.stringify({ looks: [look] })),
    ]);

    const plan = await runOutfitPlanStep(params);

    expect(plan.looks).toEqual([look]);
    expect(mock.doGenerateCalls).toHaveLength(2);
    expect(mock.doGenerateCalls[0]?.responseFormat).toMatchObject({
      type: "json",
      name: "outfit_plan",
    });
  });

  it("turns tools off on the last step so the model must answer", async () => {
    const mock = useModel([
      weatherCall("w1"),
      weatherCall("w2"),
      weatherCall("w3"),
      weatherCall("w4"),
      textReply(JSON.stringify({ looks: [look] })),
    ]);

    const plan = await runOutfitPlanStep(params);

    expect(plan.looks).toEqual([look]);
    expect(mock.doGenerateCalls).toHaveLength(5);
    expect(mock.doGenerateCalls[3]?.toolChoice).toEqual({ type: "auto" });
    expect(mock.doGenerateCalls[4]?.toolChoice).toEqual({ type: "none" });
  });
});

describe("extractJsonObject", () => {
  it("returns undefined when there is no object", () => {
    expect(extractJsonObject("no json here")).toBeUndefined();
    expect(extractJsonObject("{ broken")).toBeUndefined();
  });

  it("parses a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
});
