import { expect, test as setup } from "@playwright/test";

import { fixtures } from "./fixtures";

/** Signs every role in once through the real form and keeps the session. */
for (const role of ["owner", "staff", "practitioner", "ownerB"] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("E-posta").fill(fixtures().users[role]);
    await page.getByLabel("Parola").fill(fixtures().password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/\/panel/);
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
