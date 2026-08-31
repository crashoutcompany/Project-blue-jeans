import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { fetchWeather } from "@/lib/ai/weather/fetch-weather";

const getWeatherInputSchema = z
  .object({
    location: z
      .string()
      .max(120)
      .optional()
      .describe(
        'City or place name, e.g. "Chicago" or "London, UK". Prefer this when the user names a place.',
      ),
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .optional()
      .describe("Latitude in decimal degrees. Use with longitude when coordinates are known."),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .optional()
      .describe("Longitude in decimal degrees. Use with latitude when coordinates are known."),
  })
  .refine(
    (v) =>
      (v.location?.trim().length ?? 0) > 0 ||
      (v.latitude !== undefined && v.longitude !== undefined),
    { message: "Provide either location or both latitude and longitude." },
  );

export const getWeatherTool = tool({
  description:
    "Fetch current weather and today's forecast for a location. Call this when the user mentions where they will be, or when a known location is provided, so outfit layering matches real conditions.",
  inputSchema: getWeatherInputSchema,
  execute: async ({ location, latitude, longitude }) => {
    if (location?.trim()) {
      return fetchWeather({ location: location.trim() });
    }
    if (latitude !== undefined && longitude !== undefined) {
      return fetchWeather({ latitude, longitude });
    }
    return { ok: false as const, error: "Location is required." };
  },
});

/** Outfit-plan step 1 tools (cast keeps AI SDK ToolSet happy across package versions). */
export const outfitPlanTools = {
  getWeather: getWeatherTool,
} as ToolSet;
