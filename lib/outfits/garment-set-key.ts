/**
 * Stable uniqueness key for an Outfit: sorted unique garment ids.
 * Same clothes = same Outfit archive entry (see CONTEXT.md).
 */
export function garmentSetKey(garmentIds: string[]): string {
  return [...new Set(garmentIds.map((id) => id.trim().toLowerCase()))]
    .filter(Boolean)
    .sort()
    .join(",");
}
