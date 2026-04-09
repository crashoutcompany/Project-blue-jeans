import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { GEMINI_IMAGE_MODEL } from "@/lib/ai/gemini-models";
import { STEP2_SYSTEM, step2UserPrompt } from "@/lib/ai/lookbook/prompts";
import { firstImageDataUrl } from "@/lib/ai/lookbook/images";

export type GarmentImageSource = {
  id: string;
  category: string;
  name: string | null;
  imageUrl: string;
};

async function fetchImageAsPart(url: string): Promise<{
  type: "image";
  image: Uint8Array;
  mediaType?: string;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch garment image (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mediaType = ct?.startsWith("image/") ? ct : "image/jpeg";
  return { type: "image", image: buf, mediaType };
}

export type RunHeroImageStepParams = {
  title: string;
  description: string;
  climate: string;
  context: string;
  narrative: string;
  garments: GarmentImageSource[];
};

export async function runHeroImageStep(
  params: RunHeroImageStepParams,
): Promise<string | undefined> {
  if (params.garments.length === 0) return undefined;

  const garmentSummary = params.garments
    .map(
      (g) =>
        `${g.id} (${g.category}): ${g.name?.trim() || "piece"}`,
    )
    .join("; ");

  const intro = step2UserPrompt({
    title: params.title,
    description: params.description,
    climate: params.climate,
    context: params.context,
    narrative: params.narrative,
    garmentSummary,
  });

  const imageParts = await Promise.all(
    params.garments.map((g) => fetchImageAsPart(g.imageUrl)),
  );

  const prompt = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: `${intro}\n\nReference garment images follow in the same order as listed above.`,
        },
        ...imageParts.map((p) => ({
          type: "image" as const,
          image: p.image,
          mediaType: p.mediaType,
        })),
      ],
    },
  ];

  const imageResult = await generateText({
    model: google(GEMINI_IMAGE_MODEL),
    system: STEP2_SYSTEM,
    prompt,
    providerOptions: {
      google: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    },
  });

  return firstImageDataUrl(imageResult.files);
}
