import { generateObject } from "ai";
import { z } from "zod";

import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";
import { garmentCategorySchema } from "@/lib/garments/types";
import { outerwearVsTopsHint } from "@/lib/outfits/look-composition";

const SYSTEM = `You classify a single garment photo into one closet category.

Categories: tops, bottoms, shoes, outerwear, accessories.
${outerwearVsTopsHint()}
Pick the best single category from what is visible. If unsure between outerwear and tops, prefer tops for knits and shirts.`;

export async function suggestGarmentCategory(params: {
  apiKey: string;
  image: Uint8Array;
  mediaType: string;
  abortSignal?: AbortSignal;
}): Promise<z.infer<typeof garmentCategorySchema>> {
  const result = await generateObject({
    model: geminiModel(GEMINI_STRUCTURE_MODEL, params.apiKey),
    system: SYSTEM,
    schema: z.object({
      category: garmentCategorySchema,
    }),
    abortSignal: params.abortSignal,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Classify this garment photo.",
          },
          {
            type: "image",
            image: params.image,
            mediaType: params.mediaType,
          },
        ],
      },
    ],
  });
  return result.object.category;
}
