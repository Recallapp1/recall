#!/usr/bin/env node
/**
 * Redacts personal-looking data from a CI log on stdin before it is shown in
 * an annotation (audit B2). Test data is synthetic, but a log must never be
 * able to leak a real number, e-mail address or credential.
 *
 *   tail -n 80 e2e.log | node scripts/redact-log.mjs
 */
import { stdin, stdout } from "node:process";

/** Replacements in order; each one is pinned by src/lib/redact-log.test.ts. */
export const RULES = [
  // Turkish phone numbers: +90 / 0 / 90 prefixes, with or without separators.
  [
    /(?<![\d+])(?:(?:\+?90|0)[\s-]*)?\(?5\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g,
    "[telefon]",
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-posta]"],
  [/\b(?:key|sk|re|ghp|npg)_[A-Za-z0-9_]{12,}\b/g, "[anahtar]"],
  [/\b(?:postgres(?:ql)?|redis):\/\/[^\s'"]+/g, "[bağlantı]"],
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, "[yetki]"],
];

export function redact(text) {
  return RULES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

// Run as a filter only when executed directly (the test imports it).
if (process.argv[1]?.endsWith("redact-log.mjs")) {
  let input = "";
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => (input += chunk));
  stdin.on("end", () => stdout.write(redact(input)));
}
