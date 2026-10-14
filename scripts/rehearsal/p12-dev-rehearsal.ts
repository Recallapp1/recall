/**
 * P-12 rehearsal on the DEV database (R2 2d), never production: applies the
 * proposed schema change (unique (clinic_id, phone) index -> plain index),
 * runs a family scenario with PATIENTS_PER_NAME on through the real domain
 * code on a synthetic clinic, then removes the clinic and restores the
 * original index. Prints only pass/fail lines and counts (no personal data;
 * every name and number below is invented).
 *
 *   pnpm tsx --conditions=react-server scripts/rehearsal/p12-dev-rehearsal.ts
 */
import { devDatabaseRefusal } from "@/lib/dev-database";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const PHONE = "+905000000019"; // 0500 is not an assigned Turkish prefix
const UP = [
  `CREATE INDEX IF NOT EXISTS "patients_clinic_id_phone_idx" ON "patients" ("clinic_id", "phone")`,
  `DROP INDEX IF EXISTS "patients_clinic_id_phone_index"`,
];
const DOWN = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "patients_clinic_id_phone_index" ON "patients" ("clinic_id", "phone")`,
  `DROP INDEX IF EXISTS "patients_clinic_id_phone_idx"`,
];

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.info(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  const refusal = devDatabaseRefusal(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing to run: ${refusal}`);
    process.exitCode = 1;
    return;
  }
  process.env.PATIENTS_PER_NAME = "true";

  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/server/db");
  const schema = await import("@/server/db/schema");
  const { bookAppointment } = await import("@/server/domain/appointments");
  const { createCallbackRequest } = await import("@/server/domain/calls");
  const { parseClinicSettings } = await import("@/server/domain/clinic-settings");
  const { enqueueAppointmentMessage } = await import("@/server/domain/notifications");
  const panel = await import("@/server/domain/panel");
  const { addLocalDays, localToday } = await import("@/server/domain/time");
  const { patientsPerName } = await import("@/server/domain/patients-per-name");
  const database = db();

  const indexes = async () =>
    (
      await database.execute(
        sql`select indexname from pg_indexes where tablename = 'patients' order by indexname`,
      )
    ).rows.map((row) => String((row as { indexname: string }).indexname));
  const before = await indexes();
  check(
    "start: unique patient-number index present",
    before.includes("patients_clinic_id_phone_index"),
  );
  check("switch read as on in this process", patientsPerName());

  for (const statement of UP) await database.execute(sql.raw(statement));
  const applied = await indexes();
  check(
    "up: unique index replaced by a plain one",
    !applied.includes("patients_clinic_id_phone_index") &&
      applied.includes("patients_clinic_id_phone_idx"),
  );

  let clinicId: string | null = null;
  try {
    const [clinic] = await database
      .insert(schema.clinics)
      .values({
        slug: `p12-rehearsal-${Date.now()}`,
        name: "P12 Prova Kliniği",
        settings: { booking: { minNoticeMinutes: 0, slotIntervalMinutes: 30 } },
      })
      .returning();
    clinicId = clinic!.id;
    const ctx = { clinic: clinic!, settings: parseClinicSettings(clinic!.settings) };
    const [practitioner] = await database
      .insert(schema.practitioners)
      .values({ clinicId, name: "Prova Hekim", title: "Dt." })
      .returning();
    const [service] = await database
      .insert(schema.services)
      .values({ clinicId, name: "Muayene", durationMinutes: 30 })
      .returning();
    await database.insert(schema.workingHours).values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        clinicId: clinicId!,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
      })),
    );
    const now = new Date();
    const date = addLocalDays(localToday(now, clinic!.timezone), 2);
    const book = (time: string, patientName: string, callId?: string) =>
      bookAppointment(database, ctx, {
        serviceId: service!.id,
        practitionerId: practitioner!.id,
        date,
        time,
        patientName,
        patientPhone: PHONE,
        source: "panel",
        callId: callId ?? null,
        now,
      });
    const call = async (name: string, about: string[]) => {
      const [row] = await database
        .insert(schema.calls)
        .values({
          clinicId: clinicId!,
          provider: "retell",
          providerCallId: `p12-rehearsal-${name}-${Date.now()}`,
          fromNumber: PHONE,
          transcript: `prova ${name}`,
          summary: name,
        })
        .returning();
      for (const patientId of about) {
        await database
          .insert(schema.callPatients)
          .values({ clinicId: clinicId!, callId: row!.id, patientId });
      }
      return row!.id;
    };

    // Booking: two people on one number get two records; the same person keeps one.
    const ayse = await book("10:00", "Prova Ayşe");
    const mehmet = await book("11:00", "Prova Mehmet");
    const ayseAgain = await book("12:00", "prova ayse");
    check(
      "booking: family member gets an own record",
      ayse.appointment.patientId !== mehmet.appointment.patientId,
    );
    check(
      "booking: same person (speech-tolerant) keeps one record",
      ayseAgain.appointment.patientId === ayse.appointment.patientId,
    );
    const onNumber = await database
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(eq(schema.patients.phone, PHONE));
    check(
      "booking: exactly two patients on the number",
      onNumber.length === 2,
      `${onNumber.length}`,
    );

    // Calls and callback notes.
    const ayseCall = await call("ayse", [ayse.appointment.patientId]);
    const mehmetCall = await call("mehmet", [mehmet.appointment.patientId]);
    await call("nobody", []);
    await createCallbackRequest(database, {
      clinicId,
      callId: ayseCall,
      patientName: "Prova Ayşe",
      reason: "Fatura",
      phone: PHONE,
    });
    const appended = await createCallbackRequest(database, {
      clinicId,
      callId: ayseCall,
      patientName: "Prova Mehmet",
      reason: "Kontrol",
      phone: PHONE,
    });
    check("callbacks: second family member appended to the open note", appended?.appended === true);

    const list = await panel.listCalls(database, clinicId, { limit: 50, offset: 0 });
    check(
      "call list: one row per call",
      list.rows.length === 3 && list.total === 3,
      `${list.rows.length}/${list.total}`,
    );
    check(
      "call list: each call shows the patient it was about",
      list.rows.find((r) => r.id === mehmetCall)?.patientId === mehmet.appointment.patientId &&
        list.rows.find((r) => r.id === ayseCall)?.patientId === ayse.appointment.patientId,
    );

    const scope = panel.scopeFor(ctx);
    const search = await panel.listAppointments(database, scope, {
      from: date,
      to: addLocalDays(date, 1),
      search: "Mehmet",
    });
    check("search: finds the family member", search.rows.length === 1);

    // SMS opt-out follows the number.
    await database
      .update(schema.patients)
      .set({ smsOptOutAt: now })
      .where(eq(schema.patients.id, ayse.appointment.patientId));
    const message = await enqueueAppointmentMessage(database, {
      clinicId,
      kind: "appointment_confirmation",
      appointmentId: mehmet.appointment.id,
      patientId: mehmet.appointment.patientId,
      now,
    });
    check("SMS: an opt-out on the number covers the family member", message.optedOut);

    // Export and erasure stay per person.
    const exported = await panel.exportPatientData(database, scope, ayse.appointment.patientId);
    check(
      "export: own calls only, unattributed ones counted",
      exported?.aramalar.length === 1 && "eklenmeyenler" in (exported ?? {}),
    );
    await panel.anonymizePatient(database, clinicId, ayse.appointment.patientId, now);
    const [kept] = await database
      .select()
      .from(schema.calls)
      .where(eq(schema.calls.id, mehmetCall));
    check("erasure: the family member's call is kept", kept?.transcript === "prova mehmet");
    const [erased] = await database
      .select()
      .from(schema.calls)
      .where(eq(schema.calls.id, ayseCall));
    check(
      "erasure: the erased patient's call is emptied",
      erased?.transcript === null && erased?.fromNumber === null,
    );
  } finally {
    if (clinicId) await database.delete(schema.clinics).where(eq(schema.clinics.id, clinicId));
    const leftover = await database.execute(
      sql`select count(*)::int as n from patients where phone = ${PHONE}`,
    );
    check("cleanup: no rehearsal patients left", (leftover.rows[0] as { n: number }).n === 0);
    for (const statement of DOWN) await database.execute(sql.raw(statement));
    const after = await indexes();
    check(
      "down: index set identical to the start",
      JSON.stringify(after) === JSON.stringify(before),
      after.join(", "),
    );
  }
  console.info(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
