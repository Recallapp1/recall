/**
 * Masks personal-looking data in free text (audit B2, C1): Turkish phone
 * numbers, e-mail addresses, keys, connection strings and auth headers.
 * Used for Sentry events. scripts/redact-log.mjs (CI annotations) carries the
 * same rules for Node without TypeScript; a test keeps the two identical.
 */
export const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /(?<![\d+])(?:(?:\+?90|0)[\s-]*)?\(?5\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g,
    "[telefon]",
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-posta]"],
  [/\b(?:key|sk|re|ghp|npg)_[A-Za-z0-9_]{12,}\b/g, "[anahtar]"],
  [/\b(?:postgres(?:ql)?|redis):\/\/[^\s'"]+/g, "[bağlantı]"],
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, "[yetki]"],
];

export function redact(text: string): string {
  return REDACTIONS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}
