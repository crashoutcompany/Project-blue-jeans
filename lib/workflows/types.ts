export type WeeklyOutfitsInput = {
  /** Monday of the target week (YYYY-MM-DD, UTC). */
  weekStart: string;
  climate: string;
  context: string;
  narrative: string;
};
