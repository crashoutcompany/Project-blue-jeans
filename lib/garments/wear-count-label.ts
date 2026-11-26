/** Short card / sheet label for a Garment's "Wore this" count. */
export function formatWearCount(count: number): string {
  if (count <= 0) return "Never worn";
  return count === 1 ? "Worn once" : `Worn ${count} times`;
}
