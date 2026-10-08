/**
 * A person's name as we store it. Speech recognition writes names in one
 * case ("deneme test"); those are title-cased with Turkish rules (i → İ,
 * ı → I). A name typed in mixed case is kept: the writer meant it.
 */
export function personName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  const lower = name.toLocaleLowerCase("tr");
  const upper = name.toLocaleUpperCase("tr");
  if (name !== lower && name !== upper) return name;
  return lower.replace(
    /(^|[\s-])(\p{L})/gu,
    (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("tr"),
  );
}
