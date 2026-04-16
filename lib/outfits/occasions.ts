import { z } from "zod";

/** Matches Postgres `outfit_occasion` enum in `db/schema.sql`. */
export const OUTFIT_OCCASIONS = [
  "everyday",
  "casual",
  "business",
  "evening",
  "office",
  "gala",
] as const;

export type OutfitOccasion = (typeof OUTFIT_OCCASIONS)[number];

export const outfitOccasionSchema = z.enum(OUTFIT_OCCASIONS);
