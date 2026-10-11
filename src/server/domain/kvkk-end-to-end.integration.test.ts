import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, calls, jobRuns, toolRequests } from "../db/schema";
import { bookAppointment } from "./appointments";
import { createCallbackRequest } from "./calls";
import { anonymizePatient, exportPatientData, scopeFor, updatePatientIdentity } from "./panel";
import { applyRetention } from "./retention";

/*
 * R2 4i: KVKK end to end with synthetic data. Retention deletes what its
 * periods say in every table it covers, and the KVKK flows (booking,
 * correction, export, erasure, retention) write no name or phone number to
 * the logs.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const PHONE = "+905320000093";
const NAME = "Gizli Yılmaz";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db);
});

afterAll(async () => {
  await close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function call(providerCallId: string) {
  const [row] = await db
    .insert(calls)
    .values({ clinicId: clinic.ctx.clinic.id, provider: "retell", providerCallId })
    .returning();
  return row!.id;
}

describe("retention deletes by its periods (R2 4i)", () => {
  it("callback notes after 90 days, tool requests after 30, job runs after 90", async () => {
    const callId = await call("retention-1");
    const clinicId = clinic.ctx.clinic.id;
    await db.insert(callbackRequests).values([
      { clinicId, callId: null, phone: PHONE, reason: "eski", createdAt: daysAgo(91) },
      { clinicId, callId: null, phone: PHONE, reason: "yeni", createdAt: daysAgo(10) },
    ]);
    await db.insert(toolRequests).values([
      { clinicId, callId, requestKey: "old", tool: "book_appointment", createdAt: daysAgo(31) },
      { clinicId, callId, requestKey: "new", tool: "book_appointment", createdAt: daysAgo(1) },
    ]);
    await db.insert(jobRuns).values([
      { job: "retention", runOn: "2026-06-01", startedAt: daysAgo(91), heartbeatAt: daysAgo(91) },
      { job: "retention", runOn: "2026-10-03", startedAt: daysAgo(1), heartbeatAt: daysAgo(1) },
    ]);

    const result = await applyRetention(db, NOW);
    expect(result).toMatchObject({
      callbacksDeleted: 1,
      toolRequestsDeleted: 1,
      jobRunsDeleted: 1,
    });
    const notes = await db
      .select({ reason: callbackRequests.reason })
      .from(callbackRequests)
      .where(eq(callbackRequests.clinicId, clinicId));
    expect(notes.map((n) => n.reason)).toEqual(["yeni"]);
    const requests = await db.select({ key: toolRequests.requestKey }).from(toolRequests);
    expect(requests.map((r) => r.key)).toEqual(["new"]);
  });
});

describe("KVKK flows log no personal data (R2 4i)", () => {
  it("booking, correction, export, erasure and retention", async () => {
    const lines: string[] = [];
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(" "));
      });
    }
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "10:00",
      patientName: NAME,
      patientPhone: PHONE,
      source: "panel",
      now: NOW,
    });
    const callId = await call("kvkk-logs-1");
    await createCallbackRequest(db, {
      clinicId: clinic.ctx.clinic.id,
      callId,
      reason: "Lütfen geri arayın",
      patientName: NAME,
      phone: PHONE,
    });
    // A refused correction (invalid phone) must not echo the input either.
    await expect(
      updatePatientIdentity(db, clinic.ctx.clinic.id, {
        patientId: appointment.patientId,
        fullName: NAME,
        phone: "0532 000 00",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PHONE" });
    await updatePatientIdentity(db, clinic.ctx.clinic.id, {
      patientId: appointment.patientId,
      fullName: "Gizli Kaya",
      phone: PHONE,
    });
    await exportPatientData(db, scopeFor(clinic.ctx), appointment.patientId);
    await anonymizePatient(db, clinic.ctx.clinic.id, appointment.patientId, NOW);
    await applyRetention(db, NOW);

    const output = lines.join("\n");
    for (const secret of ["5320000093", "000 00 93", "Gizli", "Yılmaz", "Kaya"]) {
      expect(output, secret).not.toContain(secret);
    }
  });
});
