export const STEP1_SYSTEM = `You are a senior fashion stylist for a digital wardrobe app. You choose outfits only from the provided closet catalog. Every garment id you output must appear exactly in that catalog. Prefer cohesive palettes, appropriate layering for the climate, and occasion-appropriate formality.`;

export const STEP2_SYSTEM = `You are an editorial fashion photographer AI. Generate a single photorealistic full-length studio photoshoot of the outfit. Place the subject standing in front of a seamless solid-color backdrop (light gray, off-white, or similar cyclorama)—not a room, street, landscape, or lifestyle scene. Honor the reference garment images as the actual pieces to visualize. No text, logos, or watermarks on the image.`;

export const STEP2_TRYON_SYSTEM = `You are a virtual try-on fashion photographer AI. Generate a single photorealistic full-length studio photoshoot of the person in the Wearer photo wearing the referenced garments. Preserve the wearer's face, body shape, skin tone, and identity. Dress them in the exact reference garments (color, cut, texture). Place them standing in front of a seamless solid-color backdrop (light gray, off-white, or similar cyclorama)—not a room, street, or scenic environment. No text, logos, or watermarks on the image.`;

export type AlreadyPlannedLook = {
  weekday: string;
  title: string;
  garmentNames: string[];
};

export function step1UserPrompt(params: {
  lookCount: number;
  climate: string;
  context: string;
  narrative: string;
  catalogText: string;
  weekly?: boolean;
  /** Weekday name for a single-day weekly plan, e.g. "Wednesday". */
  weeklyWeekday?: string;
  alreadyPlanned?: AlreadyPlannedLook[];
}): string {
  const {
    lookCount,
    climate,
    context,
    narrative,
    catalogText,
    weekly,
    weeklyWeekday,
    alreadyPlanned,
  } = params;

  let weeklyHint: string;
  if (weekly && lookCount === 1 && weeklyWeekday) {
    weeklyHint = `You are planning **one day** of the user's week: **${weeklyWeekday}**. Produce exactly **one** outfit for that day only. Other weekdays are planned in separate requests—give this day a clear character (energy, formality) that can coexist with a varied week.`;
  } else if (weekly) {
    weeklyHint = `Produce exactly ${lookCount} outfits for a Sunday-start week. Each look should feel distinct but compatible with the same closet.`;
  } else {
    weeklyHint = `Produce exactly ${lookCount} outfit concepts. The first look (index 0) is the hero / most versatile option.`;
  }

  const planned =
    alreadyPlanned && alreadyPlanned.length > 0
      ? `Already planned this week (do not copy these looks; a garment may be reused only if it still appears in the catalog below):\n${alreadyPlanned
          .map((row) => {
            const names = row.garmentNames.join(", ") || "—";
            return `- ${row.weekday} — ${row.title} (${names})`;
          })
          .join("\n")}\n\n`
      : "";

  return `${weeklyHint}

${planned}Constraints:
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
Occasion (styling only, not a location): ${context}. Climate mood (how they dress, not weather in the shot): ${climate}.
${narrative ? `Additional direction: ${narrative}` : ""}

Photorealistic studio photoshoot: full-length, subject centered, even studio lighting, seamless solid backdrop. Do not put them in a scene.`;
}

export function step2TryOnUserPrompt(params: {
  title: string;
  description: string;
  climate: string;
  context: string;
  narrative: string;
  garmentSummary: string;
}): string {
  const { title, description, climate, context, narrative, garmentSummary } =
    params;
  return `Virtual try-on: dress the person in the Wearer photo in the outfit below. Keep their identity; replace clothing with the reference garments.

Outfit: ${title}. ${description}
Garments to wear: ${garmentSummary}
Occasion (styling and pose only, not a location): ${context}. Climate mood (how they dress, not weather in the shot): ${climate}.
${narrative ? `Additional direction: ${narrative}` : ""}

Full-length studio photoshoot of this person: centered, standing, even studio lighting, seamless solid backdrop (lookbook / e-commerce). Keep the background a flat solid color, not a scene.`;
}
