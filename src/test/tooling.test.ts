import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/*
 * Test coverage can be measured (full audit FA-26): `pnpm test:coverage` with
 * the v8 provider at the same version as Vitest. Not a CI gate yet: the report
 * informs, a threshold comes later.
 */

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("coverage tooling", () => {
  it("has a coverage script and the v8 provider pinned to Vitest's version", () => {
    expect(pkg.scripts["test:coverage"]).toBe("vitest run --coverage");
    const vitest = pkg.devDependencies.vitest?.replace(/^\^/, "");
    expect(pkg.devDependencies["@vitest/coverage-v8"]?.replace(/^\^/, "")).toBe(vitest);
  });

  it("configures the v8 provider over src/, excluding tests and test helpers", () => {
    const config = readFileSync("vitest.config.mts", "utf8");
    expect(config).toMatch(/provider:\s*"v8"/);
    expect(config).toMatch(/include:\s*\["src\/\*\*\/\*\.\{ts,tsx\}"\]/);
    expect(config).toContain('"src/test/**"');
  });
});
