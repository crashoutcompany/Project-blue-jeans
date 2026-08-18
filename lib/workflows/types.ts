import type { MembershipPolicy } from "@/lib/auth/membership";

export type WeeklyOutfitsInput = {
  userId: string;
  membership?: MembershipPolicy | null;
  /** Sunday of the target week (YYYY-MM-DD) in America/New_York. */
  weekStart: string;
  climate: string;
  context: string;
  narrative: string;
};
