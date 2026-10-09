/** Strip quotes and a mistaken leading `=` from .env / form paste errors. */
export function normalizePastedSecret(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (value.startsWith("=")) value = value.slice(1).trim();
  return value;
}
