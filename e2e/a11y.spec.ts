import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fixtures, session } from "./fixtures";

/**
 * Accessibility pass (WCAG 2.1 A/AA rules of axe-core): no serious or
 * critical violation on the public pages and the main panel screens.
 */
async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect(blocking, `${path}\n${blocking.join("\n")}`).toEqual([]);
}

test.describe("public", () => {
  for (const path of ["/", "/giris", "/sifremi-unuttum"]) {
    test(`no serious violations on ${path}`, async ({ page }) => audit(page, path));
  }
});

test.describe("panel", () => {
  test.use({ storageState: session("owner") });
  for (const path of [
    "/panel",
    "/panel/takvim",
    "/panel/randevular",
    "/panel/hastalar",
    "/panel/takip",
    "/panel/geri-arama",
    "/panel/ayarlar",
    "/panel/ayarlar/asistan",
    "/panel/ayarlar/ekip",
  ]) {
    test(`no serious violations on ${path}`, async ({ page }) => audit(page, path));
  }
  test("no serious violations on a patient page", async ({ page }) =>
    audit(page, `/panel/hastalar/${fixtures().followUpPatient}`));
});
