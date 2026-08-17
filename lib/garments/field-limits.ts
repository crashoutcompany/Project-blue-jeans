/** Shared field length caps for Garment create/update. */
export const GARMENT_FIELD_LIMITS = {
  name: 200,
  color: 120,
  notes: 4000,
  description: 4000,
} as const;

/** Max user narrative / style notes for Generator and Weekly Fits. */
export const MAX_NARRATIVE_LEN = 2000;
