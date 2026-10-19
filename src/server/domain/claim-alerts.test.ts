import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { calls, clinics, members, organizations, users } from "../db/schema";
import type { EmailMessage } from "../notifications/email";
import { alertUnbackedClaim, claimAlertRecipients } from "./claim-alerts";

const ORIGIN = "https://panel.example.test";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

let seq = 0;

/** A clinic whose team has an owner, an admin, a receptionist and a Recall console user. */
async function clinicWithTeam() {
  seq += 1;
  const clinic = await createTestClinic(db);
  const [org] = await db
    .insert(organizations)
    .values({ name: `Ekip ${seq}`, slug: `claim-team-${seq}` })
    .returning();
  await db
    .update(clinics)
    .set({ organizationId: org!.id })
    .where(eq(clinics.id, clinic.ctx.clinic.id));
  const person = async (key: string, role: string, platformRole = "user") => {
    const [user] = await db
      .insert(users)
      .values({ name: `Kişi ${key}`, email: `${key}.${seq}@ornek.test`, role: platformRole })
      .returning();
    await db.insert(members).values({ organizationId: org!.id, userId: user!.id, role });
  };
  await person("sahip", "owner");
  await person("yonetici", "admin");
  await person("resepsiyon", "staff");
  await person("konsol", "admin", "platform_admin");
  const [call] = await db
    .insert(calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: `call_claim_${seq}`,
      transcript: "User: Ayşe Demir, 0532 900 00 12.\nAgent: Randevunuz oluşturuldu.",
      startedAt: new Date("2026-10-19T08:20:00Z"),
    })
    .returning({ id: calls.id });
  return { clinicId: clinic.ctx.clinic.id, clinicName: clinic.ctx.clinic.name, callId: call!.id };
}

describe("claimAlertRecipients", () => {
  it("is the clinic's owners and admins, not staff or Recall console users", async () => {
    const { clinicId } = await clinicWithTeam();
    const recipients = await claimAlertRecipients(db, clinicId);
    expect(recipients.sort()).toEqual([`sahip.${seq}@ornek.test`, `yonetici.${seq}@ornek.test`]);
  });

  it("is empty for a clinic without a team", async () => {
    const clinic = await createTestClinic(db);
    expect(await claimAlertRecipients(db, clinic.ctx.clinic.id)).toEqual([]);
  });
});

describe("alertUnbackedClaim", () => {
  it("emails each recipient a link to the call, with no patient data", async () => {
    const { clinicId, clinicName, callId } = await clinicWithTeam();
    const sent: EmailMessage[] = [];
    const result = await alertUnbackedClaim(db, {
      clinicId,
      callId,
      origin: ORIGIN,
      send: async (message) => {
        sent.push(message);
      },
    });

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(sent.map((m) => m.to).sort()).toEqual([
      `sahip.${seq}@ornek.test`,
      `yonetici.${seq}@ornek.test`,
    ]);
    for (const message of sent) {
      expect(message.subject).toContain(clinicName);
      expect(message.text).toContain(`${ORIGIN}/panel/aramalar/${callId}`);
      // Call time in the clinic's zone (Europe/Istanbul, UTC+3).
      expect(message.text).toContain("11:20");
      for (const body of [message.text, message.html]) {
        expect(body).not.toMatch(/Ayşe|Demir|0532|900 00 12/);
      }
    }
  });

  it("tries every recipient and reports a failed send", async () => {
    const { clinicId, callId } = await clinicWithTeam();
    let attempts = 0;
    const result = await alertUnbackedClaim(db, {
      clinicId,
      callId,
      origin: ORIGIN,
      send: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("provider down");
      },
    });
    expect(attempts).toBe(2);
    expect(result).toEqual({ sent: 1, failed: 1 });
  });

  it("sends nothing for a call of another clinic", async () => {
    const own = await clinicWithTeam();
    const other = await clinicWithTeam();
    const sent: EmailMessage[] = [];
    const result = await alertUnbackedClaim(db, {
      clinicId: other.clinicId,
      callId: own.callId,
      origin: ORIGIN,
      send: async (message) => {
        sent.push(message);
      },
    });
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });
});
