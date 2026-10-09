import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";

import { GET as notificationsCron } from "../app/api/cron/notifications/route";
import { GET as retentionCron } from "../app/api/cron/retention/route";
import { rejectUnauthorizedCron } from "./cron-auth";
import { resetSmsProviderForTests, smsProvider, smsTemplates } from "./notifications/sms";

/**
 * Release guards for V0 (docs/proposals/TAKIP.md): the migration is additive,
 * no real SMS can go out without the master switch, and the cron jobs refuse
 * callers without the secret.
 */

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  resetSmsProviderForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetSmsProviderForTests();
});

// Every migration since production went live (0008 onward) must be additive.
const liveMigrations = readdirSync("drizzle")
  .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) >= 8)
  .map((name) => name.replace(/\.sql$/, ""))
  .sort();

it("checks every migration since go-live", () => {
  expect(liveMigrations).toEqual(
    expect.arrayContaining(["0008_notifications", "0010_rate_limits"]),
  );
});

/** New columns on existing tables, per migration. */
const ADDED_COLUMNS: Record<string, string[]> = {
  "0008_notifications": [
    'ALTER TABLE "patients" ADD COLUMN "sms_opt_out_at" timestamp with time zone;',
  ],
  "0013_tenant_foreign_keys": ['ALTER TABLE "practitioner_services" ADD COLUMN "clinic_id" uuid;'],
  "0016_call_flags": [
    'ALTER TABLE "calls" ADD COLUMN "flags" text[];',
    'ALTER TABLE "calls" ADD COLUMN "flagged_at" timestamp with time zone;',
  ],
  "0017_appointment_booked_for": ['ALTER TABLE "appointments" ADD COLUMN "booked_for_name" text;'],
};

/**
 * Statements outside "create or add" that were reviewed one by one: they only
 * fill or tighten a column added in the same migration (never existing data).
 */
const REVIEWED_EXCEPTIONS: Record<string, string[]> = {
  "0013_tenant_foreign_keys": [
    'UPDATE "practitioner_services" SET "clinic_id" = p."clinic_id" FROM "practitioners" p WHERE p."id" = "practitioner_services"."practitioner_id";',
    'ALTER TABLE "practitioner_services" ALTER COLUMN "clinic_id" SET NOT NULL;',
  ],
  // Fills the new link table only; existing rows are read, never changed.
  "0015_call_patients_provider_deletions": [
    'INSERT INTO "call_patients" ("clinic_id", "call_id", "patient_id") SELECT DISTINCT "clinic_id", "call_id", "patient_id" FROM "appointments" WHERE "call_id" IS NOT NULL ON CONFLICT DO NOTHING;',
  ],
};

describe.each(liveMigrations)("migration %s", (file) => {
  const sql = readFileSync(`drizzle/${file}.sql`, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) =>
      s
        .replace(/^\s*--.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const reviewed = REVIEWED_EXCEPTIONS[file] ?? [];

  it("only creates or adds; nothing is dropped, renamed, rewritten or deleted", () => {
    for (const statement of statements.filter((s) => !reviewed.includes(s))) {
      expect(statement).toMatch(
        /^(CREATE (TYPE|TABLE|INDEX|UNIQUE INDEX|FUNCTION|TRIGGER)|ALTER TABLE "\w+" ADD |ALTER TYPE "public"\."\w+" ADD VALUE )/,
      );
      // Foreign-key actions ("ON DELETE …") and trigger events ("UPDATE OF …") are not statements.
      const body = statement
        .replace(/\bON (DELETE|UPDATE) (SET NULL( \([^)]*\))?|CASCADE|NO ACTION|RESTRICT)/gi, "")
        .replace(/\bINSERT OR UPDATE OF\b/gi, "");
      expect(body).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME|UPDATE|ALTER COLUMN)\b/i);
    }
  });

  it("adds only nullable columns to existing tables (backfills are reviewed)", () => {
    const added = statements.filter((s) => /ADD COLUMN/.test(s));
    expect(added).toEqual(ADDED_COLUMNS[file] ?? []);
    for (const statement of added) expect(statement).not.toMatch(/NOT NULL/);
  });

  it("contains every reviewed exception verbatim (none silently changed)", () => {
    for (const exception of reviewed) expect(statements).toContain(exception);
  });
});

describe("SMS master switch (SMS_SENDING_ENABLED)", () => {
  it.each([undefined, "", "false", "1", "TRUE", "yes", " true"])("treats %j as off", (value) => {
    if (value !== undefined) vi.stubEnv("SMS_SENDING_ENABLED", value);
    expect(env().SMS_SENDING_ENABLED).toBe(false);
  });

  it('only the exact string "true" turns it on', () => {
    vi.stubEnv("SMS_SENDING_ENABLED", "true");
    expect(env().SMS_SENDING_ENABLED).toBe(true);
  });

  it("a configured Netgsm still does not deliver while the switch is off", () => {
    vi.stubEnv("SMS_PROVIDER", "netgsm");
    vi.stubEnv("NETGSM_USERCODE", "user");
    vi.stubEnv("NETGSM_PASSWORD", "pass");
    vi.stubEnv("NETGSM_HEADER", "RECALL");
    expect(smsProvider().delivers).toBe(false);
  });

  it("the default provider never delivers", () => {
    expect(smsProvider().delivers).toBe(false);
  });

  it("is not enabled in the example env or the repo's Vercel config", () => {
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/^SMS_SENDING_ENABLED=true/m);
    expect(readFileSync("vercel.json", "utf8")).not.toMatch(/SMS_SENDING_ENABLED/);
  });
});

describe("SMS texts (KVKK)", () => {
  const appointment = {
    date: "2026-10-06",
    time: "14:30",
    serviceName: "Kanal Tedavisi",
    patientName: "Ayşe Yılmaz",
  } as never;

  it.each(Object.entries(smsTemplates))(
    "%s carries no patient name or treatment",
    (_name, render) => {
      const text = (render as (clinic: string, a: never) => string)("Gülüş Diş", appointment);
      expect(text).not.toContain("Kanal");
      expect(text).not.toContain("Ayşe");
      // Appointment texts carry the time; the follow-up text is fully generic.
      if (_name !== "followUpReminder") expect(text).toContain("14:30");
    },
  );
});

describe("cron authorization", () => {
  const request = (authorization?: string) =>
    new Request("https://recall.test/api/cron/x", {
      headers: authorization ? { authorization } : {},
    });

  it("fails closed without a configured secret", () => {
    expect(rejectUnauthorizedCron(request("Bearer x"), undefined, "t")?.status).toBe(503);
  });

  it.each([undefined, "Bearer wrong", "bearer s3cret", "s3cret", "Bearer s3cret2", "Basic s3cret"])(
    "rejects %j",
    (authorization) => {
      expect(rejectUnauthorizedCron(request(authorization), "s3cret", "t")?.status).toBe(401);
    },
  );

  it("accepts the exact bearer secret", () => {
    expect(rejectUnauthorizedCron(request("Bearer s3cret"), "s3cret", "t")).toBeNull();
  });

  it.each([
    ["notifications", notificationsCron],
    ["retention", retentionCron],
  ])("the %s route refuses callers without the secret", async (_name, handler) => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await handler(request())).status).toBe(401);
    expect((await handler(request("Bearer wrong"))).status).toBe(401);
  });

  it.each([
    ["notifications", notificationsCron],
    ["retention", retentionCron],
  ])("the %s route does not run without CRON_SECRET", async (_name, handler) => {
    expect((await handler(request("Bearer anything"))).status).toBe(503);
  });

  it("both jobs are scheduled", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string }[];
    };
    expect(config.crons.map((c) => c.path).sort()).toEqual([
      "/api/cron/notifications",
      "/api/cron/retention",
    ]);
  });
});

// No code path may text a patient except the dispatcher, which applies the
// master switch, the provider check, the clinic setting, opt-out, the send
// window and the caps, and logs every message.
describe("single SMS path", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  const files = sources("src").map((path) => ({
    path: path.replaceAll("\\", "/"),
    text: readFileSync(path, "utf8"),
  }));

  it("only the dispatcher calls an SMS provider's send", () => {
    const callers = files
      .filter((f) => /provider\.send\(|smsProvider\(\)\.send/.test(f.text))
      .map((f) => f.path);
    expect(callers).toEqual(["src/server/domain/notifications.ts"]);
  });

  it("the provider is only obtained by the dispatcher's callers", () => {
    const users = files.filter((f) => f.text.includes("smsProvider()")).map((f) => f.path);
    expect(users.sort()).toEqual(
      [
        "src/app/api/cron/notifications/route.ts",
        "src/server/notifications/sms.ts",
        "src/server/voice/providers/retell/deps.ts",
      ].sort(),
    );
  });

  it("no direct-send helper exists any more", () => {
    expect(files.filter((f) => f.text.includes("sendSmsSafely"))).toEqual([]);
  });
});

// The WORKLOG noted a 3-hour shift when a database tool read `AT TIME ZONE`
// output as local time. The app avoids that class of bug by construction.
describe("time zone handling", () => {
  const schemaSource = readFileSync("src/server/db/schema.ts", "utf8");

  it("stores every instant as timestamptz", () => {
    const timestamps = schemaSource.match(/timestamp\([^)]*\)/g) ?? [];
    expect(timestamps.length).toBeGreaterThan(10);
    for (const column of timestamps) expect(column).toContain("withTimezone: true");
  });

  it("reads calendar dates as strings, never as JavaScript dates", () => {
    const dates = schemaSource.match(/\bdate\([^)]*\)/g) ?? [];
    expect(dates.length).toBeGreaterThan(3);
    for (const column of dates) expect(column).toContain('mode: "string"');
  });

  it("never converts time zones in SQL", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sources(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
      });
    const offenders = sources("src").filter((path) =>
      /at time zone/i.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
