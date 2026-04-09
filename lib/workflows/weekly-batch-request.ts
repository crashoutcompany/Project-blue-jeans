import { STEP2_SYSTEM, step2UserPrompt } from "@/lib/ai/lookbook/prompts";
import { loadGarmentsByIds } from "@/lib/garments/load-catalog";

async function fetchBase64Image(url: string): Promise<{
  mimeType: string;
  data: string;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Garment image fetch failed: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mimeType = ct?.startsWith("image/") ? ct : "image/jpeg";
  return { mimeType, data: buf.toString("base64") };
}

/**
 * One `GenerateContentRequest` for Gemini batch (image output + garment refs).
 */
export async function buildBatchImageRequestForLook(params: {
  title: string;
  description: string;
  garmentIds: string[];
  climate: string;
  context: string;
  narrative: string;
}): Promise<Record<string, unknown>> {
  const rows = await loadGarmentsByIds(params.garmentIds);
  const idOrder = new Map(params.garmentIds.map((id, i) => [id, i]));
  rows.sort(
    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
  );

  const garmentSummary = rows
    .map(
      (r) =>
        `${r.id} (${r.category}): ${r.name?.trim() || "piece"}`,
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

  const parts: Record<string, unknown>[] = [
    {
      text: `${intro}\n\nReference garment images follow in the same order as listed above.`,
    },
  ];

  for (const r of rows) {
    const { mimeType, data } = await fetchBase64Image(r.image_url);
    parts.push({ inlineData: { mimeType, data } });
  }

  return {
    systemInstruction: { parts: [{ text: STEP2_SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
    },
  };
}
