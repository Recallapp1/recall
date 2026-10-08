import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assistantSettingsSchema, weeklyHoursSchema } from "@/lib/contracts/settings";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import { findClinicById } from "./clinics";
import { turkishPublicHolidays } from "@/lib/holidays";

import { findAvailability } from "./scheduling";
import { localToUtc } from "./time";
import {
  addPublicHolidays,
  addTimeOff,
  listTimeOff,
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
});

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

describe("time off", () => {
  it("counts the appointments a closure overlaps and blocks booking", async () => {
    const clinic = b.ctx.clinic;
    const [patient] = await db
      .insert(schema.patients)
      .values({ clinicId: clinic.id, fullName: "Tatil Hastası", phone: "+905320000024" })
      .returning();
    const startsAt = localToUtc("2026-12-08", 10 * 60, clinic.timezone);
    await db.insert(schema.appointments).values({
      clinicId: clinic.id,
      patientId: patient!.id,
      practitionerId: b.practitionerId,
      serviceId: b.serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      source: "panel",
    });

    const result = await addTimeOff(db, clinic, {
      practitionerId: null,
      startDate: "2026-12-08",
      endDate: "2026-12-08",
      startTime: null,
      endTime: null,
      reason: "Bakım",
    });
    expect(result.conflictingAppointments).toBe(1);

    const availability = await findAvailability(db, b.ctx, {
      serviceId: b.serviceId,
      date: "2026-12-08",
      now: new Date("2026-12-01T08:00:00Z"),
    });
    expect(availability.slots).toHaveLength(0);
  });

  it("adds public holidays once", async () => {
    const clinic = a.ctx.clinic;
    const holidays = turkishPublicHolidays(2027);
    expect(holidays.some((h) => h.name === "Kurban Bayramı" && h.startDate === "2027-05-16")).toBe(
      true,
    );
    const first = await addPublicHolidays(db, clinic, holidays);
    const second = await addPublicHolidays(db, clinic, holidays);
    expect(first).toBe(holidays.length);
    expect(second).toBe(0);
    const entries = await listTimeOff(db, clinic.id, new Date("2027-01-01T00:00:00Z"));
    const arife = entries.find((e) => e.reason === "Cumhuriyet Bayramı arifesi");
    // Half day: closed from 13:00 Istanbul (10:00 UTC).
    expect(arife?.startsAt.toISOString()).toBe("2027-10-28T10:00:00.000Z");
  });
});
