import { generateObject } from "ai";
import { z } from "zod";

import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { fetchUrlAsImagePart } from "@/lib/ai/fetch-image-part";
import { geminiModel } from "@/lib/ai/gemini-provider";
import { GEMINI_STRUCTURE_MODEL } from "@/lib/ai/gemini-models";
import {
  extractProductUrls,
  MAX_PRODUCT_URLS,
} from "@/lib/ai/garments/extract-product-urls";
import { fetchProductPageText } from "@/lib/ai/garments/fetch-product-page-text";

const PRODUCT_PAGE_FETCH_CONCURRENCY = 3;

const garmentVisionSchema = z.object({
  name: z
    .string()
    .describe(
      "Short closet label (2–6 words): color + garment type, e.g. Navy wool trousers. Empty string if fillName is false.",
    ),
  description: z
    .string()
    .describe(
      "Catalog copy: 2–4 factual sentences from the photo (and product pages when provided), plain prose. Empty string if fillDescription is false.",
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
- Names: concise inventory labels (color + type), Title Case or sentence case — not marketing slogans.
- Plain prose for descriptions: no marketing, no "perfect for", no rhetorical questions.
- For color: prefer hex #RRGGBB when you can estimate from the image; otherwise a concise color name (max ~6 words).
- When a field must be left empty per the user message, output an empty string for that field — do not repeat instructions.
- If product page excerpts are provided, use factual details (garment type, cut, fabric, fit) that align with the photo. Do not invent specs that contradict the image. Color still comes from the photo.`;

export type AnalyzeGarmentFromImageParams = {
  imageUrl: string;
  name: string;
  category: string;
  maxNameLen: number;
  maxDescriptionLen: number;
  maxColorLen: number;
  /** When false, return name as "". */
  fillName: boolean;
  /** When false, return description as "". */
  fillDescription: boolean;
  /** When false, return color as "". */
  fillColor: boolean;
  /**
   * Free-text notes (may contain product URLs). Public URLs are fetched
   * server-side and passed as text context when filling name and/or description.
   */
  notes?: string | null;
  /** Explicit product URLs (merged with any found in notes). */
  productUrls?: string[];
  abortSignal?: AbortSignal;
};

export type GarmentImageAnalysis = {
  name: string;
  description: string;
  color: string;
};

function resolveProductUrls(params: AnalyzeGarmentFromImageParams): string[] {
  const fromNotes = extractProductUrls(params.notes);
  const explicit = (params.productUrls ?? [])
    .map((u) => u.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...explicit, ...fromNotes]) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= MAX_PRODUCT_URLS) break;
  }
  return out;
}

async function loadProductExcerpts(
  urls: string[],
  abortSignal?: AbortSignal,
): Promise<Array<{ url: string; text: string }>> {
  if (urls.length === 0) return [];
  const results = await mapWithConcurrency(
    urls,
    PRODUCT_PAGE_FETCH_CONCURRENCY,
    async (url) => {
      const text = await fetchProductPageText(url, { abortSignal });
      return text ? { url, text } : null;
    },
  );
  return results.filter((x): x is { url: string; text: string } => x !== null);
}

function buildUserText(
  params: AnalyzeGarmentFromImageParams,
  excerpts: Array<{ url: string; text: string }>,
): string {
  let text =
    `Current label: ${params.name}\n` +
    `Declared category: ${params.category}\n\n` +
    (params.fillName
      ? "Write a short closet name (2–6 words) for this garment.\n"
      : "Keep the existing name — set field name to exactly an empty string.\n") +
    (params.fillDescription
      ? "Write the catalog description (2–4 sentences).\n"
      : "The user already entered a catalog description — set field description to exactly an empty string.\n") +
    (params.fillColor
      ? "Infer the dominant garment color for the database (hex or short name).\n"
      : "The user already entered a color — set field color to exactly an empty string.\n");

  if (excerpts.length > 0 && (params.fillName || params.fillDescription)) {
    text += "\nProduct page excerpts (fetched server-side):\n";
    for (const ex of excerpts) {
      text += `\n--- ${ex.url} ---\n${ex.text}\n`;
    }
  }

  return text;
}

/**
 * One vision call: name and/or catalog description and/or color, depending on flags.
 * When product URLs are present and name/description is being filled, fetches those
 * public pages and includes plain-text excerpts in the prompt.
 */
export async function analyzeGarmentFromImageUrl(
  params: AnalyzeGarmentFromImageParams,
): Promise<GarmentImageAnalysis> {
  const part = await fetchUrlAsImagePart(params.imageUrl, {
    abortSignal: params.abortSignal,
  });
  const needsPageContext = params.fillName || params.fillDescription;
  const productUrls = needsPageContext ? resolveProductUrls(params) : [];
  const excerpts = await loadProductExcerpts(productUrls, params.abortSignal);
  const userText = buildUserText(params, excerpts);

  const { object } = await generateObject({
    model: geminiModel(GEMINI_STRUCTURE_MODEL),
    system: SYSTEM,
    schema: garmentVisionSchema,
    abortSignal: params.abortSignal,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image",
            image: part.image,
            mediaType: part.mediaType,
          },
        ],
      },
    ],
  });

  return {
    name: object.name.trim().slice(0, params.maxNameLen),
    description: object.description.trim().slice(0, params.maxDescriptionLen),
    color: object.color.trim().slice(0, params.maxColorLen),
  };
}
