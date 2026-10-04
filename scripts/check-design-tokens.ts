/**
 * Enforces ADR-005: colours come from DESIGN.md tokens in globals.css only.
 * Fails when UI code contains raw hex, rgb()/hsl() or Tailwind's default
 * palette (e.g. bg-zinc-700) instead of a semantic token.
 *
 *   pnpm lint:tokens
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];
const ALLOWED_FILES = new Set(["src/app/globals.css"]);
const EXTENSIONS = /\.(tsx?|css)$/;

const RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/g, message: "raw hex colour" },
  { pattern: /\b(rgba?|hsla?|oklch)\(/g, message: "raw colour function" },
  {
    pattern:
      /\b(bg|text|border|from|via|to|ring|fill|stroke|outline|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d{2,3})?\b/g,
    message: "Tailwind palette colour (use a DESIGN.md token)",
  },
  {
    // shadcn/ui's own theme names do not exist here (ADR-008); a freshly added
    // component would render unstyled without any build error.
    pattern:
      /\b(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|caret)-(background|foreground|muted|muted-foreground|popover|popover-foreground|card|card-foreground|secondary|secondary-foreground|accent-foreground|primary-foreground|destructive|input|ring|border|sidebar[\w-]*|chart-\d)(?![\w-])/g,
    message: "shadcn theme token (map it to a DESIGN.md token, see ADR-008)",
  },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name).replaceAll("\\", "/");
    return statSync(path).isDirectory() ? files(path) : EXTENSIONS.test(path) ? [path] : [];
  });
}

const problems: string[] = [];
for (const file of ROOTS.flatMap(files)) {
  if (ALLOWED_FILES.has(file)) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const { pattern, message } of RULES) {
        for (const match of line.matchAll(pattern)) {
          problems.push(`${file}:${index + 1}  ${match[0]}  → ${message}`);
        }
      }
    });
}

if (problems.length > 0) {
  console.error(`Design token violations (ADR-005):\n${problems.join("\n")}`);
  process.exit(1);
}
console.info("Design tokens: OK");
