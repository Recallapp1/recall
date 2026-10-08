import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixtures, session } from "./fixtures";

/** Tomorrow in Istanbul as YYYY-MM-DD (the clinic is open every day in the seed). */
function tomorrow(): string {
  const local = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(local);
}

test.describe("owner", () => {
  test.use({ storageState: session("owner") });

  test("books an appointment from the panel and cancels it", async ({ page }) => {
    await page.goto("/panel/randevular");
    await page.getByRole("button", { name: "Yeni randevu" }).click();
    const dialog = page.getByRole("dialog");

    const service = dialog.getByRole("combobox").first();
    if ((await service.textContent())?.includes("Hizmet seçin")) {
      await service.click();
      await page.getByRole("option", { name: "Muayene" }).click();
    }
    await dialog.getByLabel("Tarih").fill(tomorrow());
    await dialog.getByRole("button", { name: /^10:00,/ }).click();
    await dialog.getByLabel("Hasta adı soyadı").fill("Deniz Uçar");
    await dialog.getByLabel("Telefon").fill("0532 444 55 66");
    await dialog.getByRole("button", { name: /Randevuyu oluştur/ }).click();
    await expect(page.getByText("Randevu oluşturuldu").first()).toBeVisible();

    await page.goto("/panel/randevular?ara=Deniz");
    await page
      .getByRole("link", { name: /Deniz Uçar/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/panel\/randevular\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "İptal et" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "İptal et" }).click();
    await expect(page.getByText(/iptal edildi/i).first()).toBeVisible();
  });

  test("downloads the KVKK export of a patient", async ({ page }) => {
    await page.goto(`/panel/hastalar/${fixtures().patientA}`);
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Verileri indir" }).click();
    const file = await (await download).path();
    const data = JSON.parse(readFileSync(file, "utf8"));
    expect(JSON.stringify(data)).toContain("Elif Yıldız");
  });

  test("starts a follow-up plan from the patient page", async ({ page }) => {
    await page.goto(`/panel/hastalar/${fixtures().followUpPatient}`);
    await page.getByRole("button", { name: "Takibe al" }).click();
    const dialog = page.getByRole("dialog");
    const rule = dialog.getByRole("combobox").first();
    if (!(await rule.textContent())?.includes("Altı aylık kontrol")) {
      await rule.click();
      await page.getByRole("option", { name: /Altı aylık kontrol/ }).click();
    }
    await dialog.getByRole("button", { name: "Takibi başlat" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/panel/takip");
    // Due in six months: listed under "Yaklaşan", not yet a to-do.
    await page.getByRole("link", { name: /Yaklaşan 1/ }).click();
    await expect(page.getByText("Takip Hastası").first()).toBeVisible();
  });

  test("anonymises a patient after typing the confirmation word", async ({ page }) => {
    await page.goto(`/panel/hastalar/${fixtures().patientA}`);
    await page.getByRole("button", { name: "Kişisel verileri sil" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("ANONİMLEŞTİR");
    await dialog.getByRole("button", { name: "Kalıcı olarak sil" }).click();
    await expect(page).toHaveURL(/durum=anonimlestirildi/);
    await page.goto("/panel/hastalar?ara=Elif");
    await expect(page.getByText("Elif Yıldız")).toHaveCount(0);
  });

  test("switches to another clinic of theirs", async ({ page }) => {
    await page.goto("/panel");
    await page
      .getByRole("button", { name: /Klinik A/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Klinik C" }).click();
    await expect(page.getByRole("button", { name: /Klinik C/ }).first()).toBeVisible();
    // Back to clinic A for the other tests sharing this session file.
    await page
      .getByRole("button", { name: /Klinik C/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Klinik A" }).click();
    await expect(page.getByRole("button", { name: /Klinik A/ }).first()).toBeVisible();
  });

  test("cannot open another clinic's patient, appointment or export", async ({ page, request }) => {
    for (const path of [
      `/panel/hastalar/${fixtures().patientB}`,
      `/panel/randevular/${fixtures().appointmentB}`,
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Gizli Hasta")).toHaveCount(0);
    }
    const exported = await request.get(`/panel/hastalar/${fixtures().patientB}/disa-aktar`, {
      headers: {
        cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; "),
      },
    });
    expect(exported.status()).toBe(404);
  });
});

test.describe("practitioner", () => {
  test.use({ storageState: session("practitioner") });

  test("reads settings but gets 403 on team management", async ({ page }) => {
    const response = await page.goto("/panel/ayarlar/ekip");
    expect(response?.status()).toBe(403);
    await expect(page.getByText("Bu sayfa için yetkiniz yok")).toBeVisible();
  });
});

test.describe("staff", () => {
  test.use({ storageState: session("staff") });

  test("may not download patient exports", async ({ page }) => {
    const response = await page.goto(`/panel/hastalar/${fixtures().followUpPatient}/disa-aktar`);
    expect(response?.status()).toBe(403);
  });
});

test.describe("signed out", () => {
  test("is sent to sign-in with a safe return path", async ({ page }) => {
    await page.goto("/panel/randevular");
    await expect(page).toHaveURL(/\/giris\?sonra=%2Fpanel%2Frandevular/);
    await page.goto("/giris?sonra=%2F%09%2Fevil.example");
    await page.getByLabel("E-posta").fill(fixtures().users.ownerB);
    await page.getByLabel("Parola").fill(fixtures().password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/panel/);
  });
});
