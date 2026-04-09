export const STEP1_SYSTEM = `You are a senior fashion stylist for a digital wardrobe app. You choose outfits only from the provided closet catalog. Every garment id you output must appear exactly in that catalog. Prefer cohesive palettes, appropriate layering for the climate, and occasion-appropriate formality.`;

export const STEP2_SYSTEM = `You are an editorial fashion photographer AI. Generate a single photorealistic full-length outfit image. Honor the reference garment images as the actual pieces to visualize. No text, logos, or watermarks on the image.`;

export function step1UserPrompt(params: {
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  weekly?: boolean;
}): string {
  const { lookCount, climate, context, narrative, catalogText, weekly } = params;
  const weeklyHint = weekly
    ? `Produce exactly ${lookCount} outfits, one for each day of the week in order: Monday (index 0) through Sunday (index ${lookCount - 1}). Each look should feel distinct but compatible with the same closet.`
    : `Produce exactly ${lookCount} outfit concepts. The first look (index 0) is the hero / most versatile option.`;

  return `${weeklyHint}

Constraints:
- Climate vibe: ${climate}
- Occasion / setting: ${context}
- User style notes (may be empty): ${narrative || "(none)"}

Closet catalog (use only these garment ids):
${catalogText}

Return structured data matching the schema. Each look must include garmentIds (subset of catalog ids). Tags: short (1–3 words), no hashtags. Titles evocative and concise. Descriptions: silhouette, fabrics, how the look fits climate and context.`;
}

export function step2UserPrompt(params: {
  title: string;
  description: string;
  climate: string;
  context: string;
  narrative: string;
  garmentSummary: string;
}): string {
  const { title, description, climate, context, narrative, garmentSummary } =
    params;
  return `Create one high-fashion editorial full-length photograph of a single model wearing the outfit described below. The following reference images are the actual garments (preserve color, cut, and texture).

Outfit: ${title}. ${description}
Garments in frame: ${garmentSummary}
Setting / occasion: ${context}. Climate mood: ${climate}.
${narrative ? `Additional direction: ${narrative}` : ""}

Photorealistic, soft studio lighting, neutral background, sharp focus on garments.`;
}
