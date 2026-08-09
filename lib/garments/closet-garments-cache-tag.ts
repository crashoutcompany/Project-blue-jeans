/** Global legacy tag — prefer {@link closetGarmentsTag}. */
export const CLOSET_GARMENTS_TAG = "closet-garments" as const;

export function closetGarmentsTag(userId: string) {
  return `${CLOSET_GARMENTS_TAG}:${userId}` as const;
}
