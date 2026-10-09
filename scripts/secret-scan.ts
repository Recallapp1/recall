/**
 * Secret scan and sanitised review package (audit B5). Never sends anything.
 *
 *   pnpm lint:secrets      # CI: tracked files; exit 1 on any secret-like string
 *   pnpm review:package    # git archive HEAD into outputs/ + a scan report
 *
 * Values are never printed: only the kind, the file and line, and a masked
 * sample. Personal-looking data (phones, e-mails outside the test ranges) is
 * listed for review and does not fail the CI check.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isScannable, scanText, SECRET_KINDS, type Finding } from "../src/lib/secret-scan";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Tracked files as committed at HEAD (what an archive would contain). */
function scanHead(): Finding[] {
  const files = git("ls-tree", "-r", "--name-only", "HEAD").split("\n").filter(Boolean);
  return files.filter(isScannable).flatMap((path) => scanText(path, git("show", `HEAD:${path}`)));
}

function report(findings: Finding[]): string {
  const secrets = findings.filter((f) => SECRET_KINDS.has(f.kind));
  const personal = findings.filter((f) => !SECRET_KINDS.has(f.kind));
  const lines = (list: Finding[]) =>
    list.map((f) => `  ${f.kind.padEnd(18)} ${f.path}:${f.line}  ${f.sample}`).join("\n") ||
    "  (none)";
  return [
    `Secret-like strings: ${secrets.length}`,
    lines(secrets),
    "",
    `Personal-looking data outside the test ranges (review): ${personal.length}`,
    lines(personal),
  ].join("\n");
}

function main() {
  const mode = process.argv[2] ?? "lint";
  const findings = scanHead();
  const secrets = findings.filter((f) => SECRET_KINDS.has(f.kind));

  if (mode === "package") {
    const sha = git("rev-parse", "--short", "HEAD").trim();
    mkdirSync("outputs", { recursive: true });
    const archive = join("outputs", `recall-review-${sha}.zip`);
    const reportFile = join("outputs", `recall-review-${sha}.scan.txt`);
    writeFileSync(reportFile, `${report(findings)}\n`);
    if (secrets.length > 0) {
      console.error(`Secret-like strings found; no archive written. See ${reportFile}`);
      process.exitCode = 1;
      return;
    }
    git("archive", "--format=zip", "--prefix=recall/", "-o", archive, "HEAD");
    console.info(
      `Review package: ${archive}\nScan report: ${reportFile}\nNothing was sent anywhere.`,
    );
    return;
  }

  console.info(report(findings));
  if (secrets.length > 0) process.exitCode = 1;
}

main();
