import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CLINIC_TEMPLATES, slugify } from "@/lib/clinic-templates";
import { createClinicSchema } from "@/lib/contracts/platform";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestDb } from "@/test/db";

let db: Database;
let close: () => Promise<void>;
vi.mock("../db", () => ({ db: () => db }));

let platform: typeof import("./clinics");

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  platform = await import("./clinics");
});
afterAll(async () => close());

describe("slugify", () => {
  it("transliterates Turkish names", () => {
    expect(slugify("Gülüş Diş Kliniği")).toBe("gulus-dis-klinigi");
    expect(slugify("  İstanbul Fizik  Tedavi! ")).toBe("istanbul-fizik-tedavi");
  });
});

describe("createClinic", () => {
  it("creates organization, clinic, template services, hours and number in one go", async () => {
    const input = createClinicSchema.parse({
      name: "Işık Estetik",
      slug: "isik-estetik",
      template: "estetik",
      ownerName: "Ece Işık",
      ownerEmail: "ece@isik.test",
      phoneNumber: "0850 111 22 33",
    });
    const { clinicId } = await platform.createClinic(db, input);

    const [clinic] = await db.select().from(schema.clinics).where(eq(schema.clinics.id, clinicId));
    expect(clinic?.organizationId).toBeTruthy();
    const services = await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.clinicId, clinicId));
    expect(services).toHaveLength(CLINIC_TEMPLATES.estetik.services.length);
    const numbers = await db
      .select()
      .from(schema.phoneNumbers)
      .where(eq(schema.phoneNumbers.clinicId, clinicId));
    expect(numbers.map((n) => n.e164)).toEqual(["+908501112233"]);

    const overview = await platform.getClinicOverview(db, clinicId, new Date());
    const labels = Object.fromEntries(overview!.checklist.map((item) => [item.label, item.done]));
    expect(labels["En az bir aktif hizmet"]).toBe(true);
    expect(labels["En az bir aktif hekim"]).toBe(false);
    expect(labels["Telefon numarası bağlı"]).toBe(true);
  });

  it("rejects a taken slug and a taken number without leaving half a clinic", async () => {
    const base = { template: "dis", ownerName: "X Y", ownerEmail: "x@y.test" };
    await expect(
      platform.createClinic(
        db,
        createClinicSchema.parse({ ...base, name: "Kopya", slug: "isik-estetik", phoneNumber: "" }),
      ),
    ).rejects.toMatchObject({ code: "SLUG_TAKEN" });
    await expect(
      platform.createClinic(
        db,
        createClinicSchema.parse({
          ...base,
          name: "Numara",
          slug: "numara-klinik",
          phoneNumber: "08501112233",
        }),
      ),
    ).rejects.toMatchObject({ code: "PHONE_TAKEN" });
    const [orphan] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.slug, "numara-klinik"));
    expect(orphan).toBeUndefined();
  });

  it("pauses and lists clinics with zeroed stats", async () => {
    const [clinic] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.slug, "isik-estetik"));
    await platform.setClinicStatus(db, clinic!.id, "paused");
    const list = await platform.listClinicsOverview(db, new Date());
    const row = list.find((c) => c.id === clinic!.id);
    expect(row).toMatchObject({ status: "paused", numbers: 1, stats: { calls: 0 } });
  });
});
