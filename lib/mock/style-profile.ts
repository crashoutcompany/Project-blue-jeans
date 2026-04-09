export const MOCK_AESTHETICS = [
  { id: "minimalist", label: "Minimalist", selected: true },
  { id: "avant", label: "Avant-garde", selected: false },
  { id: "heritage", label: "Heritage", selected: false },
  { id: "nightlife", label: "Nightlife", selected: false },
] as const;

export const MOCK_STYLE_TAGS = [
  "Structured fabrics",
  "Monochromatic",
  "Oversized silhouette",
] as const;

export const MOCK_CURATED_TONES = [
  {
    name: "Emerald deep",
    role: "Primary signature",
    hex: "#003527",
  },
  {
    name: "Sandstone",
    role: "Neutral foundation",
    hex: "#c4b5a0",
  },
  {
    name: "Parchment",
    role: "Base layer",
    hex: "#f9f9f6",
  },
  {
    name: "Terracotta clay",
    role: "Accent narrative",
    hex: "#501e12",
  },
] as const;

export const MOCK_SILHOUETTE = {
  heightCm: 185,
  build: "Athletic / slim",
  shoulders: "Broad",
  fit: "relaxed" as "slim" | "relaxed" | "boxy",
};

export const MOCK_STYLE_INSIGHTS =
  "You favor clean silhouettes with one tactile accent. Add a single statement outer layer when dressing for evening events.";

export const MOCK_MOOD_ITEMS = [
  { id: "m1", label: "Boot", tone: "#2a2a2a" },
  { id: "m2", label: "Knit", tone: "#1f1f1f" },
  { id: "m3", label: "Upload", tone: "upload" as const },
  { id: "m4", label: "Suede", tone: "#a89078" },
  { id: "m5", label: "Carry", tone: "#222" },
] as const;
