import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assistantSettingsSchema, weeklyHoursSchema } from "@/lib/contracts/settings";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import { findClinicById } from "./clinics";
import {
  listPractitionerDetails,
  loadWeeklyHours,
  replaceClinicHours,
  savePractitioner,
  saveService,
  updateAssistantSettings,
} from "./settings";

let db: Database;
let close: () => Promise<void>;
let a: TestClinic;
let b: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  a = await createTestClinic(db);
  b = await createTestClinic(db);
}, 30_000);

afterAll(async () => close());

describe("weekly hours contract", () => {
  it("rejects overlapping ranges on the same day", () => {
    const result = weeklyHoursSchema.safeParse([
      { weekday: 1, startTime: "09:00", endTime: "13:00" },
      { weekday: 1, startTime: "12:30", endTime: "18:00" },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts a lunch break", () => {
    const result = weeklyHoursSchema.safeParse([
      { weekday: 1, startTime: "09:00", endTime: "12:30" },
      { weekday: 1, startTime: "13:30", endTime: "18:00" },
    ]);
    expect(result.success).toBe(true);
  });
});

describe("clinic configuration", () => {
  it("replaces the clinic's opening hours", async () => {
    await replaceClinicHours(db, a.ctx.clinic.id, [
      { weekday: 6, startTime: "10:00", endTime: "14:00" },
    ]);
    expect(await loadWeeklyHours(db, a.ctx.clinic.id, null)).toEqual([
      { weekday: 6, startTime: "10:00", endTime: "14:00" },
    ]);
    // The other clinic is untouched.
    expect((await loadWeeklyHours(db, b.ctx.clinic.id, null)).length).toBe(5);
  });

  it("creates a practitioner with services and own hours", async () => {
    const serviceId = await saveService(db, a.ctx.clinic.id, {
      name: "Kanal Tedavisi",
      description: null,
      aliases: ["kanal"],
      durationMinutes: 60,
      priceMin: 500000,
      priceMax: 900000,
      isActive: true,
    });
    const id = await savePractitioner(db, a.ctx.clinic.id, {
      name: "Selin Aydın",
      title: "Dt.",
      isActive: true,
      serviceIds: [serviceId],
      hours: [{ weekday: 2, startTime: "09:00", endTime: "17:00" }],
    });
    const detail = (await listPractitionerDetails(db, a.ctx.clinic.id)).find((p) => p.id === id);
    expect(detail).toMatchObject({ serviceIds: [serviceId], hours: [{ weekday: 2 }] });
  });

  it("refuses another clinic's service", async () => {
    await expect(
      savePractitioner(db, a.ctx.clinic.id, {
        name: "Yabancı Hizmet",
        title: null,
        isActive: true,
        serviceIds: [b.serviceId],
        hours: [],
      }),
    ).rejects.toMatchObject({ code: "INVALID_SERVICE" });
  });

  it("refuses to edit another clinic's practitioner", async () => {
    await expect(
      savePractitioner(db, a.ctx.clinic.id, {
        id: b.practitionerId,
        name: "Ele Geçirme",
        title: null,
        isActive: false,
        serviceIds: [],
        hours: [],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PRACTITIONER" });
    const [untouched] = await db
      .select({ name: schema.practitioners.name })
      .from(schema.practitioners)
      .where(eq(schema.practitioners.id, b.practitionerId));
    expect(untouched?.name).toBe("Can Demir");
  });

  it("updates assistant settings without losing other sections", async () => {
    await updateAssistantSettings(
      db,
      a.ctx.clinic.id,
      assistantSettingsSchema.parse({
        name: "Deniz",
        greeting: "",
        speakPrices: true,
        recordCalls: false,
        extraInstructions: "",
        faq: [{ q: "Otopark var mı?", a: "Evet." }],
      }),
    );
    const ctx = await findClinicById(db, a.ctx.clinic.id);
    expect(ctx?.settings.assistant).toMatchObject({
      name: "Deniz",
      speakPrices: true,
      recordCalls: false,
    });
    expect(ctx?.settings.assistant.greeting).toBeUndefined();
    expect(ctx?.settings.booking.slotIntervalMinutes).toBe(30);
  });
});
