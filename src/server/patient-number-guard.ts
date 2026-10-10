/**
 * CI guard for P-12 (src/server/production-safety.test.ts): the unique
 * (clinic_id, phone) index on patients may only be dropped once no code
 * relies on it to deduplicate patients. Pure string checks, no I/O.
 */

/** Whether a migration drops the unique patient-number index. */
export function dropsPatientNumberIndex(migrationSql: string): boolean {
  return /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(?:"?public"?\.)?"?patients_clinic_id_phone_index"?/i.test(
    migrationSql,
  );
}

/**
 * Where source code still saves patients with an ON CONFLICT that needs the
 * unique number index: a Drizzle insert into the patients table chained with
 * an onConflictDo… call, or the same in raw SQL.
 * Returns 1-based line numbers.
 */
export function relyOnPatientNumberIndex(source: string): number[] {
  const lines: number[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  const drizzle =
    /\.insert\(\s*(?:schema\.)?patients\s*\)[\s\S]{0,400}?(?:;|\.returning\(|\.onConflictDo\w+\()/g;
  for (const match of source.matchAll(drizzle)) {
    if (/\.onConflictDo\w+\($/.test(match[0])) lines.push(lineOf(match.index));
  }
  const raw = /insert\s+into\s+"?patients"?[^;]*?\bon\s+conflict\b/gi;
  for (const match of source.matchAll(raw)) lines.push(lineOf(match.index));
  return lines;
}
