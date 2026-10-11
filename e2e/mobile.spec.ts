import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { fixtures, session } from "./fixtures";

/**
 * Phone width (R2 4f): the reception staff and clinic owners open the panel
 * on phones. No page may scroll sideways at 375 px, and the accessibility
 * rules hold there too.
 */
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

async function noSidewaysScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
      .filter((el) => getComputedStyle(el).position !== "fixed")
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
    return { scroll: root.scrollWidth - root.clientWidth, wide };
  });
  expect(
    overflow.scroll,
    `${path} scrolls sideways: ${overflow.wide.join(" | ")}`,
  ).toBeLessThanOrEqual(1);
}

async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => v.id);
  expect(blocking).toEqual([]);
}

test.describe("public at phone width", () => {
  for (const path of ["/", "/giris"]) {
    test(`${path} fits`, async ({ page }) => {
      await noSidewaysScroll(page, path);
      await audit(page);
    });
  }
});

test.describe("panel at phone width", () => {
  test.use({ storageState: session("owner") });
  for (const path of [
    "/panel",
    "/panel/takvim",
    "/panel/randevular",
    "/panel/hastalar",
    "/panel/aramalar",
    "/panel/geri-arama",
    "/panel/ayarlar",
  ]) {
    test(`${path} fits`, async ({ page }) => {
      await noSidewaysScroll(page, path);
      await audit(page);
    });
  }
  test("a patient page fits", async ({ page }) => {
    await noSidewaysScroll(page, `/panel/hastalar/${fixtures().followUpPatient}`);
    await audit(page);
  });
});
