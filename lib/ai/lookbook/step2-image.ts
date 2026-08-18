import { generateText } from "ai";

import { fetchUrlAsImagePart } from "@/lib/ai/fetch-image-part";
import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_IMAGE_MODEL } from "@/lib/ai/gemini-models";
import {
  STEP2_SYSTEM,
  STEP2_TRYON_SYSTEM,
  step2TryOnUserPrompt,
  step2UserPrompt,
} from "@/lib/ai/lookbook/prompts";
import { firstImageDataUrl } from "@/lib/ai/lookbook/images";

export type GarmentImageSource = {
  id: string;
  category: string;
  name: string | null;
  imageUrl: string;
};

export type RunHeroImageStepParams = {
  apiKey: string;
  title: string;
  description: string;
  climate: string;
  context: string;
  narrative: string;
  garments: GarmentImageSource[];
  /** When set, composite garments onto this Wearer photo (primary hero path). */
  wearerPhotoUrl?: string | null;
};

export async function runHeroImageStep(
  params: RunHeroImageStepParams,
): Promise<string | undefined> {
  if (params.garments.length === 0) return undefined;

  const garmentSummary = params.garments
    .map((g) => `${g.id} (${g.category}): ${g.name?.trim() || "piece"}`)
    .join("; ");

  const tryOn = Boolean(params.wearerPhotoUrl?.trim());

  const intro = tryOn
    ? step2TryOnUserPrompt({
        title: params.title,
        description: params.description,
        climate: params.climate,
        context: params.context,
        narrative: params.narrative,
        garmentSummary,
      })
    : step2UserPrompt({
        title: params.title,
        description: params.description,
        climate: params.climate,
        context: params.context,
        narrative: params.narrative,
        garmentSummary,
      });

  const garmentParts = await Promise.all(
    params.garments.map((g) => fetchUrlAsImagePart(g.imageUrl)),
  );

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array | string; mediaType?: string }
  > = [
    {
      type: "text",
      text: tryOn
        ? `${intro}\n\nFirst image: the Wearer photo (identity / body). Following images: garments in the order listed above.`
        : `${intro}\n\nReference garment images follow in the same order as listed above.`,
    },
  ];

  if (tryOn && params.wearerPhotoUrl) {
    const wearerPart = await fetchUrlAsImagePart(params.wearerPhotoUrl);
    content.push({
      type: "image",
      image: wearerPart.image,
      mediaType: wearerPart.mediaType,
    });
  }

  for (const p of garmentParts) {
    content.push({
      type: "image",
      image: p.image,
      mediaType: p.mediaType,
    });
  }

  const imageResult = await generateText({
    model: geminiModel(GEMINI_IMAGE_MODEL, params.apiKey),
    system: tryOn ? STEP2_TRYON_SYSTEM : STEP2_SYSTEM,
    prompt: [
      {
        role: "user" as const,
        content,
      },
    ],
    providerOptions: {
      google: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    },
  });

  return firstImageDataUrl(imageResult.files);
}
