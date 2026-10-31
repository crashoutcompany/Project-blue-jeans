import { z } from "zod";

/** Limits applied after parsing. Gemini ignores maxLength / maxItems, so they live in `.describe()` text. */
export const LOOK_LIMITS = {
  title: 120,
  description: 500,
  tag: 40,
  tags: 5,
  garmentIds: 14,
  curatorNote: 600,
} as const;

/**
 * Schema sent to Gemini and used to parse its reply. It is deliberately loose:
 * `@ai-sdk/google` drops maxLength, maxItems, minItems and pattern when it
 * converts the schema, so the model never sees those limits. Enforcing them in
 * Zod made a slightly long description or a sixth tag fail the whole call with
 * `AI_NoObjectGeneratedError`. Limits are applied by `normalizeLookbookPlan`,
 * and garment ids are checked against the closet by `validate-ids`.
 */
export function createLookbookModelSchema(lookCount: number) {
  const look = z.object({
    title: z
      .string()
      .describe(`Evocative outfit title, at most ${LOOK_LIMITS.title} characters.`),
    description: z
      .string()
      .describe(
        `Silhouette, fabrics, and how the look fits the weather and occasion. At most ${LOOK_LIMITS.description} characters.`,
      ),
    tags: z
      .array(z.string())
      .describe(
        `1 to ${LOOK_LIMITS.tags} short tags (1–3 words each), no hashtags.`,
      ),
    garmentIds: z
      .array(z.string())
      .describe(
        "Garment ids copied exactly from the closet catalog. Include a top, a bottom, and shoes.",
      ),
  });
  return z.object({
    looks: z
      .array(look)
      .describe(`Exactly ${lookCount} outfit${lookCount === 1 ? "" : "s"}.`),
    curatorNote: z
      .string()
      .nullish()
      .describe(
        `Optional short note to the wearer, at most ${LOOK_LIMITS.curatorNote} characters.`,
      ),
  });
}

export type LookbookModelOutput = z.infer<
  ReturnType<typeof createLookbookModelSchema>
>;

export type LookbookLook = {
  title: string;
  description: string;
  tags: string[];
  garmentIds: string[];
};

export type LookbookPlan = {
  looks: LookbookLook[];
  curatorNote?: string;
};

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trimEnd();
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = clip(raw.replace(/^#+/, ""), LOOK_LIMITS.tag);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === LOOK_LIMITS.tags) break;
  }
  return out;
}

/**
 * Apply the limits the model could not see. Returns null when the reply has
 * fewer looks than requested, which the caller treats like an unparseable reply.
 */
export function normalizeLookbookPlan(
  raw: LookbookModelOutput,
  lookCount: number,
): LookbookPlan | null {
  if (raw.looks.length < lookCount) return null;
  const looks = raw.looks.slice(0, lookCount).map((look) => ({
    title: clip(look.title, LOOK_LIMITS.title) || "Untitled look",
    description: clip(look.description, LOOK_LIMITS.description),
    tags: normalizeTags(look.tags),
    garmentIds: [
      ...new Set(look.garmentIds.map((id) => id.trim().toLowerCase())),
    ]
      .filter(Boolean)
      .slice(0, LOOK_LIMITS.garmentIds),
  }));
  const note = raw.curatorNote ? clip(raw.curatorNote, LOOK_LIMITS.curatorNote) : "";
  return note ? { looks, curatorNote: note } : { looks };
}
