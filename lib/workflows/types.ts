export type WeeklyOutfitsInput = {
  userId: string;
  /** Sunday of the target week (YYYY-MM-DD) in America/New_York. */
  weekStart: string;
  climate: string;
  context: string;
  narrative: string;
};
