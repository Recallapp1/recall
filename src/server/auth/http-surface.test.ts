import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { EmailMessage } from "@/server/notifications/email";
import { createTestClinic, createTestDb } from "@/test/db";

/*
 * Better Auth's organization endpoints, reached past our server actions
 * (docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md, P-04).
 */

let testDb: Database;
vi.mock("../db", () => ({ db: () => testDb }));

const sent: EmailMessage[] = [];
let close: () => Promise<void>;
let modules: {
  auth: typeof import(".").auth;
  accounts: typeof import("./accounts");
};

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  ({ db: testDb, close } = await createTestDb());
  const email = await import("../notifications/email");
  email.setEmailProvider({ send: async (message) => void sent.push(message) });
  modules = { auth: (await import(".")).auth, accounts: await import("./accounts") };
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

async function ownerOfNewClinic(email: string, password: string) {
  const { ctx } = await createTestClinic(testDb);
  await modules.accounts.addClinicMember({
    clinicId: ctx.clinic.id,
    email,
    name: "Klinik Sahibi",
    role: "owner",
  });
  const token = /sifre-belirle\?token=([\w-]+)/.exec(sent.at(-1)?.text ?? "")?.[1];
  await modules.auth().api.resetPassword({ body: { token: token!, newPassword: password } });
  const { headers } = await modules.auth().api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const [clinic] = await testDb
    .select({ organizationId: schema.clinics.organizationId })
    .from(schema.clinics)
    .where(eq(schema.clinics.id, ctx.clinic.id));
  return { headers: new Headers({ cookie }), organizationId: clinic!.organizationId! };
}

describe("organization deletion through the API", () => {
  it("leaves the clinic's members in place when an owner tries it", async () => {
    const { headers, organizationId } = await ownerOfNewClinic(
      "silme@klinik.test",
      "silme-parola-123",
    );

    const attempt = await modules
      .auth()
      .api.deleteOrganization({ body: { organizationId }, headers })
      .then(
        () => "deleted",
        (error: unknown) => `refused: ${String((error as Error).message ?? error)}`,
      );

    const remaining = await testDb
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(eq(schema.members.organizationId, organizationId));
    const [org] = await testDb
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));

    // Before the fix the delete was refused by the clinics foreign key only
    // after every member had been removed: the clinic was locked out.
    expect(attempt).toContain("Klinik silinemez");
    expect(org).toBeDefined();
    expect(remaining).toHaveLength(1);
  });
});

describe("public /api/auth route", () => {
  const url = (path: string) => `http://localhost:3000/api/auth/${path}`;

  it("serves only the harmless reads", async () => {
    const route = await import("@/app/api/auth/[...all]/route");
    expect((await route.GET(new Request(url("ok")))).status).toBe(200);
    expect((await route.GET(new Request(url("get-session")))).status).toBe(200);
    expect((await route.GET(new Request(url("organization/list-members")))).status).toBe(404);
  });

  it("closes every write, including sign-in and team endpoints", async () => {
    const route = await import("@/app/api/auth/[...all]/route");
    for (const path of [
      "sign-in/email",
      "sign-up/email",
      "request-password-reset",
      "organization/create-role",
      "organization/update-member-role",
      "organization/invite-member",
      "organization/remove-member",
      "organization/delete",
      "admin/impersonate-user",
    ]) {
      const response = await route.POST(
        new Request(url(path), {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" },
        }),
      );
      expect(response.status, path).toBe(404);
    }
  });

  it("audits a signed-in member who probes a closed endpoint", async () => {
    const route = await import("@/app/api/auth/[...all]/route");
    const { headers, organizationId } = await ownerOfNewClinic(
      "yoklama@klinik.test",
      "yoklama-parola-123",
    );
    headers.set("content-type", "application/json");
    const response = await route.POST(
      new Request(url("organization/create-role"), { method: "POST", body: "{}", headers }),
    );
    expect(response.status).toBe(404);

    const [clinic] = await testDb
      .select({ id: schema.clinics.id })
      .from(schema.clinics)
      .where(eq(schema.clinics.organizationId, organizationId));
    const events = await testDb
      .select({ action: schema.auditEvents.action, metadata: schema.auditEvents.metadata })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.clinicId, clinic!.id));
    expect(events).toContainEqual({
      action: "security.auth_endpoint_blocked",
      metadata: { method: "POST", endpoint: "organization/create-role" },
    });
  });
});
