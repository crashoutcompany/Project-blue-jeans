import type { OutfitLook } from "./types";

export const MOCK_OUTFIT_OF_DAY = {
  id: "ootd-1",
  name: "The Solstice ensemble",
  summary:
    "Layered emerald wool with a soft cashmere base—balanced for crisp mornings and indoor warmth.",
  labels: [
    { text: "Primary piece: Overcoat in emerald", position: "top" as const },
    { text: "Layering: Cashmere knit", position: "mid" as const },
  ],
  tags: ["Business casual", "62°F / 17°C", "Office hours"],
};

export const MOCK_GENERATOR_LOOKS: OutfitLook[] = [
  {
    id: "l1",
    title: "The ethereal professional",
    description:
      "Structured lines with a whisper of texture—polished enough for the studio, soft enough for after hours.",
    tags: ["Prime pick", "Bohemian texture"],
    featured: true,
  },
  {
    id: "l2",
    title: "Earthbound chic",
    description: "Wool-forward layers with warm neutrals and grounded footwear.",
    tags: ["Casual", "Wool", "Terra"],
  },
  {
    id: "l3",
    title: "Twilight noir",
    description: "Monochrome depth with a single accent in deep green.",
    tags: ["Evening", "Silk", "Noir"],
  },
];

export const MOCK_DASHBOARD_RECOMMENDATION = {
  title: "Elevate with leather textures.",
  body: "Your archive skews soft cottons—introducing a single leather piece this week will add contrast without breaking your palette.",
  cta: "See alternative",
};

export const MOCK_DNA_INSIGHT =
  "Your collection is currently 42% organic textiles. Consider balancing with structured wools for transitional weather.";

export const MOCK_CURATOR_NOTE =
  "Our model has noticed a recurring preference for heavy wools and deep greens. Lean into texture contrast on your next gala look.";
