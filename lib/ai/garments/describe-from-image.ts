import { generateObject } from "ai";
import { z } from "zod";

import { fetchUrlAsImagePart } from "@/lib/ai/fetch-image-part";
import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";

const garmentVisionSchema = z.object({
  description: z
    .string()
    .describe(
      "Catalog copy: 2–4 factual sentences from the photo, plain prose. Empty string if fillDescription is false.",
    ),
  color: z
    .string()
    .describe(
      "Dominant visible color: #RRGGBB when reasonably clear, else a short name (e.g. heather charcoal). Empty string if fillColor is false.",
    ),
});

const SYSTEM = `You analyze a single garment photo for a digital closet.

Rules:
- Ground every claim in what is visible. The user's name/label may be wrong; prefer the image.
- Plain prose for descriptions: no marketing, no "perfect for", no rhetorical questions.
- For color: prefer hex #RRGGBB when you can estimate from the image; otherwise a concise color name (max ~6 words).
- When a field must be left empty per the user message, output an empty string for that field — do not repeat instructions.`;

export type AnalyzeGarmentFromImageParams = {
  imageUrl: string;
  name: string;
  category: string;
  maxDescriptionLen: number;
  maxColorLen: number;
  /** When false, return description as "". */
  fillDescription: boolean;
  /** When false, return color as "". */
  fillColor: boolean;
};

export type GarmentImageAnalysis = {
  description: string;
  color: string;
};

/**
 * One vision call: catalog description and/or dominant color, depending on flags.
 */
export async function analyzeGarmentFromImageUrl(
  params: AnalyzeGarmentFromImageParams,
): Promise<GarmentImageAnalysis> {
  const part = await fetchUrlAsImagePart(params.imageUrl);

  const userText =
    `User-provided label: ${params.name}\n` +
    `Declared category: ${params.category}\n\n` +
    (params.fillDescription
      ? "Write the catalog description (2–4 sentences) from the image.\n"
      : "The user already entered a catalog description — set field description to exactly an empty string.\n") +
    (params.fillColor
      ? "Infer the dominant garment color for the database (hex or short name).\n"
      : "The user already entered a color — set field color to exactly an empty string.\n");

  const { object } = await generateObject({
    model: geminiModel(GEMINI_STRUCTURE_MODEL),
    system: SYSTEM,
    schema: garmentVisionSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image", image: part.image, mediaType: part.mediaType },
        ],
      },
    ],
  });

  return {
    description: object.description
      .trim()
      .slice(0, params.maxDescriptionLen),
    color: object.color.trim().slice(0, params.maxColorLen),
  };
}
