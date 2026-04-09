export type CatalogGarment = {
  id: string;
  category: string;
  name: string | null;
  color: string | null;
  notes: string | null;
  description: string | null;
};

/**
 * Single markdown block for step-1 context (IDs must be copy-pasteable).
 */
export function formatClosetCatalog(garments: CatalogGarment[]): string {
  if (garments.length === 0) {
    return "(empty closet)";
  }
  const lines = garments.map((g) => {
    const name = g.name?.trim() || "Untitled";
    const desc = g.description?.trim() || "(no description)";
    const color = g.color?.trim() || "—";
    const notes = g.notes?.trim() || "—";
    return `- **${g.id}** | ${g.category} | ${name} | color: ${color} | desc: ${desc} | notes: ${notes}`;
  });
  return lines.join("\n");
}
