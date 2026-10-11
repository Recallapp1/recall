import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { patients } from "../db/schema";
import { anonymizePatient, updatePatientIdentity } from "./panel";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("updatePatientIdentity (KVKK correction, G-02)", () => {
  it("reports only the fields that changed, and nothing for an unchanged form", async () => {
    const clinic = await createTestClinic(db);
    const [patient] = await db
      .insert(patients)
      .values({ clinicId: clinic.ctx.clinic.id, fullName: "Ayşe Yılmaz", phone: "+905320000088" })
      .returning();
    const input = { patientId: patient!.id, fullName: "Ayşe Yılmaz", phone: "0532 000 00 88" };
    expect(await updatePatientIdentity(db, clinic.ctx.clinic.id, input)).toEqual([]);
    expect(
      await updatePatientIdentity(db, clinic.ctx.clinic.id, { ...input, fullName: "Ayşe Kaya" }),
    ).toEqual(["fullName"]);
  });

  it("refuses an erased patient and another clinic's patient", async () => {
    const clinic = await createTestClinic(db);
    const other = await createTestClinic(db);
    const [patient] = await db
      .insert(patients)
      .values({ clinicId: clinic.ctx.clinic.id, fullName: "Silinen Kişi", phone: "+905320000089" })
      .returning();
    const input = { patientId: patient!.id, fullName: "Yeni Ad", phone: "05320000090" };
    await expect(updatePatientIdentity(db, other.ctx.clinic.id, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await anonymizePatient(db, clinic.ctx.clinic.id, patient!.id);
    await expect(updatePatientIdentity(db, clinic.ctx.clinic.id, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
