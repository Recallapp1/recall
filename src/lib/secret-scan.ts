/**
 * Finds secret-like and personal-looking strings in text (audit B5). Used by
 * `pnpm lint:secrets` (CI: tracked files) and `pnpm review:package` (the
 * sanitised archive for external reviewers). Findings carry the kind, the
 * line and a masked sample, never the value itself.
 */

export type FindingKind =
  | "retell_key"
  | "resend_key"
  | "llm_key"
  | "github_token"
  | "aws_key"
  | "private_key"
  | "jwt"
  | "credential_url"
  | "secret_assignment"
  | "phone"
  | "email";

/** Secrets fail the check; personal-looking data is reported for review only. */
export const SECRET_KINDS: ReadonlySet<FindingKind> = new Set<FindingKind>([
  "retell_key",
  "resend_key",
  "llm_key",
  "github_token",
  "aws_key",
  "private_key",
  "jwt",
  "credential_url",
  "secret_assignment",
]);

export interface Finding {
  path: string;
  line: number;
  kind: FindingKind;
  /** First characters and length only. */
  sample: string;
}

const PATTERNS: Array<[FindingKind, RegExp]> = [
  ["retell_key", /\bkey_[a-f0-9]{24,}\b/g],
  ["resend_key", /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/g],
  ["llm_key", /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/g],
  ["github_token", /\bgh[pousr]_[A-Za-z0-9]{30,}/g],
  ["aws_key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["jwt", /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g],
  [
    "credential_url",
    /\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s:@/'"`]+:[^\s@/'"`]+@[^\s/'"`]+/g,
  ],
  [
    "secret_assignment",
    /\b[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|DSN)\s*[=:]\s*["']?(?![<$({])[^\s"'`,;)]{12,}/g,
  ],
  ["phone", /(?<![\d+])(?:\+90|0)\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}(?!\d)/g],
  ["email", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
];

/** Placeholders and test values that look like findings but are not. */
const ALLOWED: Array<[FindingKind, RegExp]> = [
  ["credential_url", /@(?:localhost|127\.0\.0\.1|\$\{|host\b|unused)/],
  ["credential_url", /^postgres:\/\/(?:u|ci|x|recall|postgres):/],
  [
    "secret_assignment",
    /(?:change-me|ci-only|e2e-|test-secret|not-used|xxxx|0123456789|example|placeholder|recall-development-secret)/i,
  ],
  ["secret_assignment", /[=:]\s*(?:z\.|env\(|process\.env|optional|string|config\.)/],
  // Obviously fake ranges used in tests and docs, and the documented example.
  [
    "phone",
    /^(?:\+90|0)\s?5(?:32\s?000|32\s?900|55\s?000|55\s?999|55\s?100|55\s?200|55\s?111|00\s?000|32\s?123\s?45\s?67)/,
  ],
  ["email", /@(?:[\w-]+\.)*(?:test|local|example|ornek\.com|klinik\.com|recall\.local)\b/i],
];

export function mask(value: string): string {
  return value.length <= 8 ? `${value.slice(0, 2)}…` : `${value.slice(0, 6)}…(${value.length})`;
}

export function scanText(path: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split("\n").forEach((line, index) => {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        const value = match[0];
        if (ALLOWED.some(([k, allow]) => k === kind && allow.test(value))) continue;
        findings.push({ path, line: index + 1, kind, sample: mask(value) });
      }
    }
  });
  return findings;
}

/** Files never scanned: generated or vendored content with checksums. */
export function isScannable(path: string): boolean {
  return (
    !/(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/.test(path) &&
    !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|wav|mp3|mp4|pdf|zip)$/i.test(path) &&
    !/^drizzle\/meta\//.test(path) &&
    // Its fixtures are fake secrets on purpose.
    path !== "src/lib/secret-scan.test.ts"
  );
}
