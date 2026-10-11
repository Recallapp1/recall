import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, calls } from "../db/schema";
import { createCallbackRequest } from "./calls";

/*
 * Two family members ask for a callback in one call from one number
 * (R2 2c, P-12). The open-note index (clinic, call, number) stays; with
 * PATIENTS_PER_NAME the second person's request is kept in the same note.
 */

const PHONE = "+905320000076";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function callFor(clinic: TestClinic) {
  const [row] = await db
    .insert(calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: `cb-${Math.random()}`,
      fromNumber: PHONE,
    })
    .returning();
  return row!.id;
}

async function note(id: string) {
  const [row] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, id));
  return row!;
}

function request(clinic: TestClinic, callId: string, patientName: string, reason: string) {
  return { clinicId: clinic.ctx.clinic.id, callId, patientName, reason, phone: PHONE };
}

describe("two callback requests from one call for one number", () => {
  it("switch unset: the second request returns the first note unchanged (as before)", async () => {
    const clinic = await createTestClinic(db);
    const callId = await callFor(clinic);
    const first = await createCallbackRequest(
      db,
      request(clinic, callId, "Ayşe Yılmaz", "Fatura sorusu"),
      { perName: false },
    );
    const second = await createCallbackRequest(
      db,
      request(clinic, callId, "Mehmet Yılmaz", "Kontrol randevusu"),
      { perName: false },
    );
    expect(second).toEqual({ id: first!.id, created: false });
    expect((await note(first!.id)).reason).toBe("Fatura sorusu");
  });

  it("switch on: a family member's request is appended to the open note, once", async () => {
    const clinic = await createTestClinic(db);
    const callId = await callFor(clinic);
    const first = await createCallbackRequest(
      db,
      request(clinic, callId, "Ayşe Yılmaz", "Fatura sorusu"),
      { perName: true },
    );
    const second = await createCallbackRequest(
      db,
      request(clinic, callId, "Mehmet Yılmaz", "Kontrol randevusu"),
      { perName: true },
    );
    expect(second).toEqual({ id: first!.id, created: false, appended: true });
    expect((await note(first!.id)).reason).toBe("Fatura sorusu\nMehmet Yılmaz: Kontrol randevusu");

    // A retried tool call for Mehmet, or Ayşe again (speech-tolerant), adds nothing.
    await createCallbackRequest(db, request(clinic, callId, "Mehmet Yılmaz", "Kontrol randevusu"), {
      perName: true,
    });
    const again = await createCallbackRequest(
      db,
      request(clinic, callId, "ayse yilmaz", "Başka bir şey"),
      { perName: true },
    );
    expect(again).toEqual({ id: first!.id, created: false });
    expect((await note(first!.id)).reason).toBe("Fatura sorusu\nMehmet Yılmaz: Kontrol randevusu");
    const rows = await db
      .select({ id: callbackRequests.id })
      .from(callbackRequests)
      .where(eq(callbackRequests.callId, callId));
    expect(rows).toHaveLength(1);
  });

  it("switch on: the note never grows past the stored maximum", async () => {
    const clinic = await createTestClinic(db);
    const callId = await callFor(clinic);
    const first = await createCallbackRequest(
      db,
      request(clinic, callId, "Ayşe Yılmaz", "a".repeat(480)),
      { perName: true },
    );
    await createCallbackRequest(db, request(clinic, callId, "Mehmet Yılmaz", "b".repeat(100)), {
      perName: true,
    });
    expect((await note(first!.id)).reason.length).toBeLessThanOrEqual(500);
  });
});
