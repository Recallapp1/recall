import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { builtInRolesAllow, type Permissions } from "@/lib/permissions";
import * as schema from "@/server/db/schema";
import {
  actAs,
  actionState,
  createMember,
  createPlatformAdmin,
  createTestClinic,
  ForbiddenSignal,
  NotFoundSignal,
  RedirectSignal,
  setUpActionTests,
  type TestUser,
} from "@/test/actions";
import type { TestClinic } from "@/test/db";

/*
 * Every server action file, through the real session, membership and
 * permission checks (docs/HARDENING-2026-10.md): who may call it, what it
 * rejects, and that ids of another clinic never reach that clinic's data.
 */

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  db: () => actionState.db,
}));
vi.mock("next/headers", () => ({
  headers: async () => actionState.headers,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
  forbidden: () => {
    throw new ForbiddenSignal();
  },
  notFound: () => {
    throw new NotFoundSignal();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void actionState.after.push(task),
}));
vi.mock("@/server/voice/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/voice/sync")>()),
  scheduleAssistantSync: () => {},
  syncAssistantNow: async () => null,
  ensureAssistant: async () => ({ status: "unchanged" }),
  createTestWebCall: async () => ({ ok: false, reason: "not_configured" }),
  listAssistantVoices: async () => [],
  deleteProviderCalls: async () => {},
  freshRecordingUrl: async () => "https://rec.test/recording.wav",
}));

let close: () => Promise<void>;
let a: TestClinic;
let b: TestClinic;
const users = {} as Record<"owner" | "staff" | "practitioner" | "ownerB" | "admin", TestUser>;
/** Rows of clinic B that clinic A's members must never reach. */
const bRows = {} as {
  patientId: string;
  appointmentId: string;
  callbackId: string;
  callId: string;
  timeOffId: string;
  ruleId: string;
  memberId: string;
};

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  ({ close } = await setUpActionTests());
  const db = actionState.db;
  a = await createTestClinic(db);
  b = await createTestClinic(db);
  const { setClinicFeature } = await import("@/server/domain/settings");
  await setClinicFeature(db, a.ctx.clinic.id, "followUp", true);
  await setClinicFeature(db, b.ctx.clinic.id, "followUp", true);

  users.owner = await createMember(a, "owner");
  users.staff = await createMember(a, "staff");
  users.practitioner = await createMember(a, "practitioner");
  users.ownerB = await createMember(b, "owner");
  users.admin = await createPlatformAdmin(a);

  const [patient] = await db
    .insert(schema.patients)
    .values({
      clinicId: b.ctx.clinic.id,
      fullName: "B Hastası",
      phone: "+905559990001",
      notes: "B notu",
    })
    .returning();
  const [call] = await db
    .insert(schema.calls)
    .values({
      clinicId: b.ctx.clinic.id,
      provider: "retell",
      providerCallId: "b_call_1",
      recordingUrl: "https://rec.test/b.wav",
    })
    .returning();
  const [appointment] = await db
    .insert(schema.appointments)
    .values({
      clinicId: b.ctx.clinic.id,
      patientId: patient!.id,
      practitionerId: b.practitionerId,
      serviceId: b.serviceId,
      startsAt: new Date("2026-12-01T07:00:00Z"),
      endsAt: new Date("2026-12-01T07:30:00Z"),
      source: "panel",
      notes: "B randevu notu",
    })
    .returning();
  const [callback] = await db
    .insert(schema.callbackRequests)
    .values({ clinicId: b.ctx.clinic.id, reason: "B geri arama", phone: "+905559990001" })
    .returning();
  const [timeOff] = await db
    .insert(schema.timeOff)
    .values({
      clinicId: b.ctx.clinic.id,
      startsAt: new Date("2026-12-24T06:00:00Z"),
      endsAt: new Date("2026-12-24T15:00:00Z"),
    })
    .returning();
  const { saveRule } = await import("@/server/domain/follow-ups");
  const ruleId = await saveRule(db, b.ctx.clinic.id, null, {
    name: "B kuralı",
    triggerServiceId: null,
    visitServiceId: b.serviceId,
    intervalValue: 6,
    intervalUnit: "month",
    totalVisits: null,
    smsReminders: false,
    isActive: true,
  });
  const [memberB] = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.users.email, users.ownerB.email));
  Object.assign(bRows, {
    patientId: patient!.id,
    appointmentId: appointment!.id,
    callbackId: callback!.id,
    callId: call!.id,
    timeOffId: timeOff!.id,
    ruleId,
    memberId: memberB!.id,
  });
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

/** Snapshot of clinic B's rows, to prove nothing an A member did changed them. */
async function clinicBState() {
  const db = actionState.db;
  const id = b.ctx.clinic.id;
  return {
    patients: await db.select().from(schema.patients).where(eq(schema.patients.clinicId, id)),
    appointments: await db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.clinicId, id)),
    callbacks: await db
      .select()
      .from(schema.callbackRequests)
      .where(eq(schema.callbackRequests.clinicId, id)),
    timeOff: await db.select().from(schema.timeOff).where(eq(schema.timeOff.clinicId, id)),
    rules: await db
      .select()
      .from(schema.followUpRules)
      .where(eq(schema.followUpRules.clinicId, id)),
    plans: await db
      .select()
      .from(schema.followUpPlans)
      .where(eq(schema.followUpPlans.clinicId, id)),
    members: await db.select().from(schema.members).where(eq(schema.members.id, bRows.memberId)),
    clinic: await db.select().from(schema.clinics).where(eq(schema.clinics.id, id)),
  };
}

const formData = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

/**
 * Every clinic action, called by an A member with clinic B's ids (or invalid
 * input). `permission` is what the action requires; for roles that hold it
 * the call must fail softly and leave clinic B untouched.
 */
const cases: Array<{ name: string; permission: Permissions; call: () => Promise<unknown> }> = [
  // ayarlar
  {
    name: "saveClinicProfile",
    permission: { clinicSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).saveClinicProfile({}),
  },
  {
    name: "saveClinicHours",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).saveClinicHours({ days: "x" }),
  },
  {
    name: "savePractitionerSettings (B practitioner)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).savePractitionerSettings({
        id: b.practitionerId,
        name: "Ele geçir",
        title: null,
        isActive: true,
        serviceIds: [],
        hours: [],
      }),
  },
  {
    name: "saveServiceSettings (B service)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).saveServiceSettings({
        id: b.serviceId,
        name: "Ele geçir",
        aliases: [],
        description: null,
        durationMinutes: 30,
        priceMin: null,
        priceMax: null,
        isActive: false,
      }),
  },
  {
    name: "saveAssistantSettings",
    permission: { assistantSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).saveAssistantSettings({}),
  },
  {
    name: "saveAssistantVoice",
    permission: { assistantSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).saveAssistantVoice({ voiceId: 12 }),
  },
  {
    name: "saveBookingRules",
    permission: { clinicSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).saveBookingRules({}),
  },
  {
    name: "savePanelPreferences",
    permission: { clinicSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).savePanelPreferences({}),
  },
  {
    name: "syncAssistant",
    permission: { assistantSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).syncAssistant(),
  },
  {
    name: "startTestCall",
    permission: { assistantSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).startTestCall(),
  },
  {
    name: "addTimeOffEntry (B practitioner)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).addTimeOffEntry({
        practitionerId: b.practitionerId,
        startDate: "2026-12-02",
        endDate: "2026-12-02",
        allDay: true,
        startTime: null,
        endTime: null,
        reason: null,
      }),
  },
  {
    name: "removeTimeOffEntry (B row)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/actions")).removeTimeOffEntry(bRows.timeOffId),
  },
  {
    name: "addPublicHolidayEntries",
    permission: { clinicSettings: ["update"] },
    call: async () => (await import("./panel/(app)/ayarlar/actions")).addPublicHolidayEntries(1999),
  },
  // ekip
  {
    name: "inviteMember",
    permission: { invitation: ["create"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/ekip/actions")).inviteMember({
        email: "yok",
        role: "staff",
      }),
  },
  {
    name: "cancelInvitation",
    permission: { invitation: ["cancel"] },
    call: async () => (await import("./panel/(app)/ayarlar/ekip/actions")).cancelInvitation("x"),
  },
  {
    name: "updateMember (B member)",
    permission: { member: ["update"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/ekip/actions")).updateMember({
        memberId: bRows.memberId,
        role: "staff",
        practitionerId: null,
      }),
  },
  {
    name: "removeMember (B member)",
    permission: { member: ["delete"] },
    call: async () =>
      (await import("./panel/(app)/ayarlar/ekip/actions")).removeMember(bRows.memberId),
  },
  {
    name: "saveCustomRole",
    permission: { ac: ["create"] },
    call: async () => (await import("./panel/(app)/ayarlar/ekip/actions")).saveCustomRole({}),
  },
  {
    name: "deleteCustomRole",
    permission: { ac: ["delete"] },
    call: async () => (await import("./panel/(app)/ayarlar/ekip/actions")).deleteCustomRole(""),
  },
  // randevular
  {
    name: "getAvailableSlots (B service)",
    permission: { appointments: ["create"] },
    call: async () =>
      (await import("./panel/(app)/randevular/actions")).getAvailableSlots({
        serviceId: b.serviceId,
        date: "2026-12-01",
      }),
  },
  {
    name: "createAppointment (B service and practitioner)",
    permission: { appointments: ["create"] },
    call: async () =>
      (await import("./panel/(app)/randevular/actions")).createAppointment(
        { status: "idle" },
        formData({
          serviceId: b.serviceId,
          practitionerId: b.practitionerId,
          date: "2026-12-01",
          time: "11:00",
          patientName: "Ele Geçir",
          patientPhone: "05559990002",
        }),
      ),
  },
  {
    name: "setAppointmentStatus (B appointment)",
    permission: { appointments: ["cancel"] },
    call: async () =>
      (await import("./panel/(app)/randevular/actions")).setAppointmentStatus({
        appointmentId: bRows.appointmentId,
        status: "cancelled",
      }),
  },
  {
    name: "saveAppointmentNotes (B appointment)",
    permission: { appointments: ["update"] },
    call: async () =>
      (await import("./panel/(app)/randevular/actions")).saveAppointmentNotes(
        { status: "idle" },
        formData({ appointmentId: bRows.appointmentId, notes: "değiştirildi" }),
      ),
  },
  // hastalar
  {
    name: "savePatientNotes (B patient)",
    permission: { patients: ["update"] },
    call: async () =>
      (await import("./panel/(app)/hastalar/actions")).savePatientNotes(
        { status: "idle" },
        formData({ patientId: bRows.patientId, notes: "değiştirildi" }),
      ),
  },
  {
    name: "anonymizePatientAction (B patient)",
    permission: { patients: ["anonymize"] },
    call: async () =>
      (await import("./panel/(app)/hastalar/actions")).anonymizePatientAction(bRows.patientId),
  },
  {
    name: "setSmsOptOut (B patient)",
    permission: { patients: ["update"] },
    call: async () =>
      (await import("./panel/(app)/hastalar/actions")).setSmsOptOut(bRows.patientId, true),
  },
  // geri-arama, aramalar
  {
    name: "updateCallback (B callback)",
    permission: { callbacks: ["update"] },
    call: async () =>
      (await import("./panel/(app)/geri-arama/actions")).updateCallback({
        callbackId: bRows.callbackId,
        status: "done",
      }),
  },
  {
    name: "getRecordingUrl (B call)",
    permission: { calls: ["listen_recording"] },
    call: async () =>
      (await import("./panel/(app)/aramalar/actions")).getRecordingUrl(bRows.callId),
  },
  // takip
  {
    name: "startFollowUp (B rule and patient)",
    permission: { followUps: ["manage"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).startFollowUp({
        ruleId: bRows.ruleId,
        patientId: bRows.patientId,
        appointmentId: null,
        startedOn: "2026-11-01",
        smsConsent: false,
      }),
  },
  {
    name: "followUpAction",
    permission: { followUps: ["manage"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).followUpAction({
        type: "pause",
        planId: bRows.ruleId,
      }),
  },
  {
    name: "saveFollowUpRule (B rule)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).saveFollowUpRule(bRows.ruleId, {
        name: "Ele geçir",
        triggerServiceId: null,
        visitServiceId: a.serviceId,
        intervalValue: 1,
        intervalUnit: "month",
        totalVisits: null,
        smsReminders: false,
        isActive: true,
      }),
  },
  {
    name: "archiveFollowUpRule (B rule)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).archiveFollowUpRule(bRows.ruleId),
  },
  {
    name: "duplicateFollowUpRule (B rule)",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).duplicateFollowUpRule(bRows.ruleId),
  },
  {
    name: "addFollowUpExamples",
    permission: { clinicSettings: ["update"] },
    call: async () => (await import("./panel/(app)/takip/actions")).addFollowUpExamples("yok"),
  },
  {
    name: "saveFollowUpSettings",
    permission: { clinicSettings: ["update"] },
    call: async () =>
      (await import("./panel/(app)/takip/actions")).saveFollowUpSettings({ dueSoonDays: -1 }),
  },
];

describe("clinic actions: permission, validation and tenant isolation", () => {
  it.each(["owner", "staff", "practitioner"] as const)(
    "%s gets 403 exactly where the permission matrix says, and never changes clinic B",
    async (role) => {
      const before = await clinicBState();
      actAs(users[role]);
      for (const testCase of cases) {
        const allowed = builtInRolesAllow(role, testCase.permission) ?? false;
        let outcome: unknown;
        try {
          outcome = await testCase.call();
        } catch (error) {
          outcome = error;
        }
        if (!allowed) {
          expect(outcome, `${testCase.name} for ${role}`).toBeInstanceOf(ForbiddenSignal);
        } else {
          // Returned normally: not a 403, not a redirect, not a crash.
          expect(outcome, `${testCase.name} for ${role}`).not.toBeInstanceOf(Error);
          // Allowed, but the input is invalid or belongs to clinic B: never a success.
          if (outcome && typeof outcome === "object" && "ok" in outcome) {
            expect((outcome as { ok: boolean }).ok, `${testCase.name} for ${role}`).toBe(false);
          }
          if (outcome && typeof outcome === "object" && "status" in outcome) {
            expect((outcome as { status: string }).status, `${testCase.name}`).not.toBe("success");
          }
        }
      }
      expect(await clinicBState()).toEqual(before);
    },
    120_000,
  );

  it("sends a signed-out caller to the sign-in page", async () => {
    actAs(null);
    for (const testCase of cases.slice(0, 5)) {
      await expect(testCase.call()).rejects.toBeInstanceOf(RedirectSignal);
    }
    const { savePreferences } = await import("./panel/(app)/tercihler/actions");
    await expect(savePreferences({})).rejects.toMatchObject({ to: "/giris" });
  });

  it("refuses the KVKK export of another clinic's patient (404) and allows its own", async () => {
    actAs(users.owner);
    const { GET } = await import("./panel/(app)/hastalar/[id]/disa-aktar/route");
    const context = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
    const foreign = await GET(new Request("http://localhost/x"), context(bRows.patientId));
    expect(foreign.status).toBe(404);

    const [own] = await actionState.db
      .insert(schema.patients)
      .values({ clinicId: a.ctx.clinic.id, fullName: "A Hastası", phone: "+905551110001" })
      .returning();
    const response = await GET(new Request("http://localhost/x"), context(own!.id));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("A Hastası");
    // Staff may not export (owner and admin only).
    actAs(users.staff);
    await expect(GET(new Request("http://localhost/x"), context(own!.id))).rejects.toBeInstanceOf(
      ForbiddenSignal,
    );
  });

  it("does the real thing for the clinic's own data", async () => {
    actAs(users.staff);
    const { updateCallback } = await import("./panel/(app)/geri-arama/actions");
    const [own] = await actionState.db
      .insert(schema.callbackRequests)
      .values({ clinicId: a.ctx.clinic.id, reason: "A geri arama" })
      .returning();
    expect(await updateCallback({ callbackId: own!.id, status: "done" })).toMatchObject({
      ok: true,
    });
  });
});

describe("member preferences and clinic switching", () => {
  it("cannot switch into a clinic the user does not belong to", async () => {
    actAs(users.owner);
    const { switchClinic } = await import("./panel/actions");
    const [clinicB] = await actionState.db
      .select({ organizationId: schema.clinics.organizationId })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, b.ctx.clinic.id));
    await expect(switchClinic(clinicB!.organizationId!)).rejects.toMatchObject({
      to: "/panel/klinik-sec",
    });
  });

  it("validates preferences and saves them for the member only", async () => {
    actAs(users.practitioner);
    const { savePreferences } = await import("./panel/(app)/tercihler/actions");
    expect(await savePreferences({ startPage: "yok" })).toMatchObject({ ok: false });
    // A calendar filter on another clinic's practitioner is refused.
    expect(
      await savePreferences({
        startPage: "takvim",
        calendarView: "week",
        calendarPractitionerId: b.practitionerId,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("Recall console actions", () => {
  const consoleCalls = async () => {
    const admin = await import("./admin/actions");
    return [
      () => admin.setClinicStatusAction(b.ctx.clinic.id, "paused"),
      () => admin.setClinicFeatureAction(b.ctx.clinic.id, "followUp", false),
      () => admin.addPhoneNumberAction({ clinicId: b.ctx.clinic.id, e164: "+902120009999" }),
      () => admin.removePhoneNumberAction(b.ctx.clinic.id, bRows.timeOffId),
      () => admin.syncAssistantAction(b.ctx.clinic.id, false),
      () =>
        admin.addClinicMemberAction({
          clinicId: b.ctx.clinic.id,
          name: "Ele Geçir",
          email: "ele@gecir.test",
          role: "owner",
        }),
      () => admin.setDemoRequestStatusAction("00000000-0000-4000-8000-000000000000", "won"),
      () => admin.createClinicAction({ status: "idle" }, formData({})),
    ];
  };

  it("are refused to clinic owners (no impersonation, no cross-clinic power)", async () => {
    const before = await clinicBState();
    actAs(users.owner);
    for (const call of await consoleCalls()) {
      await expect(call()).rejects.toBeInstanceOf(ForbiddenSignal);
    }
    expect(await clinicBState()).toEqual(before);
  });

  it("validate their input for the Recall team", async () => {
    actAs(users.admin);
    const admin = await import("./admin/actions");
    expect(await admin.setClinicStatusAction("yok", "paused")).toMatchObject({ ok: false });
    expect(
      await admin.addPhoneNumberAction({ clinicId: b.ctx.clinic.id, e164: "abc" }),
    ).toMatchObject({ ok: false });
    expect(
      await admin.addClinicMemberAction({
        clinicId: b.ctx.clinic.id,
        name: "X",
        email: "x",
        role: "owner",
      }),
    ).toMatchObject({ ok: false });
    expect(await admin.createClinicAction({ status: "idle" }, formData({}))).toMatchObject({
      status: "error",
    });
  });
});

describe("public actions", () => {
  it("ignores bots on the demo form and validates people", async () => {
    actAs(null);
    const { submitDemoRequest } = await import("./(marketing)/actions");
    const bot = await submitDemoRequest({ status: "idle" }, formData({ website: "spam" }));
    expect(bot).toMatchObject({ status: "success" });
    expect(await actionState.db.select().from(schema.demoRequests)).toEqual([]);
    const invalid = await submitDemoRequest({ status: "idle" }, formData({ fullName: "A" }));
    expect(invalid).toMatchObject({ status: "error" });
  });

  it("does not reveal whether an e-mail has an account", async () => {
    actAs(null);
    const { requestPasswordLink, signIn } = await import("./(auth)/actions");
    const known = await requestPasswordLink(
      { status: "idle" },
      formData({ email: users.owner.email }),
    );
    const unknown = await requestPasswordLink(
      { status: "idle" },
      formData({ email: "kimse@yok.test" }),
    );
    expect(known).toEqual(unknown);
    const wrong = await signIn(
      { status: "idle" },
      formData({ email: users.owner.email, password: "yanlis-parola-123" }),
    );
    const missing = await signIn(
      { status: "idle" },
      formData({ email: "kimse@yok.test", password: "yanlis-parola-123" }),
    );
    expect(wrong).toEqual(missing);
  });
});
