export const CLOSET_SAVED_OUTFITS_TAG = "closet-saved-outfits" as const;

export function closetSavedOutfitsTag(userId: string) {
  return `${CLOSET_SAVED_OUTFITS_TAG}:${userId}` as const;
}
