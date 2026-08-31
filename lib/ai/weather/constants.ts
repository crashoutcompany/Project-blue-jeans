/** Default place for weather-aware outfit planning. */
export const DEFAULT_OUTFIT_LOCATION = "New York, NY";

export function resolveOutfitLocation(userLocation?: string): string {
  const trimmed = userLocation?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  return DEFAULT_OUTFIT_LOCATION;
}
