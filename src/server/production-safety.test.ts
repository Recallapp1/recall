import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";

import { GET as notificationsCron } from "../app/api/cron/notifications/route";
import { GET as providerDeletionsCron } from "../app/api/cron/provider-deletions/route";
import { GET as remindersCron } from "../app/api/cron/reminders/route";
import { GET as retentionCron } from "../app/api/cron/retention/route";
import { rejectUnauthorizedCron } from "./cron-auth";
import { dropsPatientNumberIndex, relyOnPatientNumberIndex } from "./patient-number-guard";
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
  // Two-step sign-in (docs/proposals/2FA-TOTP): nullable, so no table rewrite.
  "0019_two_factor": ['ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;'],
  // Per-call latency (CALL_LATENCY_STORE): nullable, written only with the switch on.
  "0020_call_latency": ['ALTER TABLE "calls" ADD COLUMN "latency" jsonb;'],
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
    ["provider-deletions", providerDeletionsCron],
    ["reminders", remindersCron],
  ])("the %s route refuses callers without the secret", async (_name, handler) => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await handler(request())).status).toBe(401);
    expect((await handler(request("Bearer wrong"))).status).toBe(401);
  });

  it.each([
    ["notifications", notificationsCron],
    ["retention", retentionCron],
    ["provider-deletions", providerDeletionsCron],
    ["reminders", remindersCron],
  ])("the %s route does not run without CRON_SECRET", async (_name, handler) => {
    expect((await handler(request("Bearer anything"))).status).toBe(503);
  });

  it("the hourly deletion queue route stays off without DELETION_QUEUE_HOURLY (R2 5a)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const response = await providerDeletionsCron(request("Bearer s3cret"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "disabled" });
  });

  it("the hourly reminders route stays off without HOURLY_REMINDERS (R2 5b)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const response = await remindersCron(request("Bearer s3cret"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "disabled" });
  });

  // The hourly-ready routes (R2 5a, 5b) are not scheduled: Hobby [PLAN: Hobby] allows daily cron only.
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
        // Hourly reminders (R2 5b): sends only through dispatchNotifications.
        "src/app/api/cron/reminders/route.ts",
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

describe("CI supply chain (B1)", () => {
  const workflows = readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f));

  it.each(workflows)("%s pins every action to a commit and reads only", (file) => {
    const text = readFileSync(`.github/workflows/${file}`, "utf8");
    const uses = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) expect(ref, ref).toMatch(/@[0-9a-f]{40}$/);
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
    const code = text.replace(/^\s*#.*$/gm, "");
    expect(code).not.toMatch(/pull_request_target|secrets\./);
  });
});

describe("configuration documentation (B6)", () => {
  // Every variable the app reads is documented for local setup and for production.
  const keys = [...readFileSync("src/lib/env.ts", "utf8").matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)]
    .map((m) => m[1]!)
    .filter((key) => key !== "NODE_ENV");
  const example = readFileSync(".env.example", "utf8");
  const deployment = readFileSync("docs/06-operations/DEPLOYMENT.md", "utf8");

  it.each(keys)("%s is in .env.example and DEPLOYMENT.md", (key) => {
    expect(example).toMatch(new RegExp(`^#? ?${key}=`, "m"));
    expect(deployment).toContain(key);
  });
});

describe("legal drafts (C6)", () => {
  const files = readdirSync("docs/legal-drafts").filter((f) => f.endsWith(".md"));

  it.each(files)("%s is marked as an unreviewed draft", (file) => {
    expect(readFileSync(`docs/legal-drafts/${file}`, "utf8")).toContain(
      "DRAFT, not reviewed by a lawyer",
    );
  });

  it("is not published: no app route serves these texts", () => {
    const appFiles = readdirSync("src/app", { recursive: true }) as string[];
    expect(appFiles.some((f) => /kvkk|gizlilik|kullanim-kosullari|aydinlatma/i.test(f))).toBe(
      false,
    );
  });
});

// ─── P-12: the unique patient-number index ───────────────────────────────────

/** Non-test TypeScript under src/ and scripts/. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("unique patient-number index (P-12)", () => {
  const allMigrations = readdirSync("drizzle").filter((name) => /^\d{4}_.*\.sql$/.test(name));
  const dropping = allMigrations.filter((name) =>
    dropsPatientNumberIndex(readFileSync(join("drizzle", name), "utf8")),
  );
  const relying = [...sourceFiles("src"), ...sourceFiles("scripts")].flatMap((file) =>
    relyOnPatientNumberIndex(readFileSync(file, "utf8")).map((line) => `${file}:${line}`),
  );

  it("is not dropped by any migration while code still saves patients with ON CONFLICT on it", () => {
    if (dropping.length > 0) expect(relying, `dropped by ${dropping.join(", ")}`).toEqual([]);
  });

  it("no code relies on it today (P-12 step 1: patients are looked up first)", () => {
    expect(relying).toEqual([]);
  });

  it("migration 0019 is the two-step sign-in table, not the patient-number change (planned as 0021; 0020 is call latency)", () => {
    const twoFactor = readFileSync(join("drizzle", "0019_two_factor.sql"), "utf8");
    expect(dropsPatientNumberIndex(twoFactor)).toBe(false);
    expect(twoFactor).not.toMatch(/DROP/i);
    expect(dropping).toEqual([]);
  });

  it("guard self-test: recognises the drop and the old save", () => {
    expect(dropsPatientNumberIndex('DROP INDEX IF EXISTS "patients_clinic_id_phone_index";')).toBe(
      true,
    );
    expect(dropsPatientNumberIndex("drop index concurrently patients_clinic_id_phone_index")).toBe(
      true,
    );
    expect(dropsPatientNumberIndex('DROP INDEX "patients_clinic_id_id_key";')).toBe(false);
    expect(
      dropsPatientNumberIndex('CREATE INDEX "patients_clinic_id_phone_idx" ON "patients"'),
    ).toBe(false);

    // The booking save before P-12 step 1 (appointments.ts, 2026-10-09).
    const before = [
      "const [patient] = await tx",
      "  .insert(patients)",
      "  .values({ clinicId: clinic.id, fullName: personName(input.patientName), phone })",
      "  .onConflictDoUpdate({",
      "    target: [patients.clinicId, patients.phone],",
      "    set: { updatedAt: sql`now()` },",
      "  })",
      "  .returning({ id: patients.id });",
    ].join(String.fromCharCode(10));
    expect(relyOnPatientNumberIndex(before)).toEqual([2]);
    expect(
      relyOnPatientNumberIndex("db.insert(schema.patients).values(rows).onConflictDoNothing();"),
    ).toEqual([1]);
    expect(
      relyOnPatientNumberIndex(
        'INSERT INTO "patients" (clinic_id, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      ),
    ).toEqual([1]);
    // Today's save and other tables' conflicts are fine.
    expect(
      relyOnPatientNumberIndex(
        "await exec.insert(patients).values({ clinicId }).returning({ id: patients.id });",
      ),
    ).toEqual([]);
    expect(
      relyOnPatientNumberIndex("db.insert(callPatients).values(row).onConflictDoNothing();"),
    ).toEqual([]);
  });
});

describe("deploy docs follow the build (full audit FA-05)", () => {
  const deployment = readFileSync("docs/06-operations/DEPLOYMENT.md", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  it("every vercel-build command quoted in DEPLOYMENT.md is the real one", () => {
    const quoted = [...deployment.matchAll(/"vercel-build":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThan(0);
    for (const command of quoted) expect(command).toBe(pkg.scripts["vercel-build"]);
  });

  it("the rollback section says the assistant does not roll back with a promoted deploy", () => {
    const rollback = deployment.slice(deployment.indexOf("## Geri alma"));
    expect(rollback).toMatch(/Promote to Production/);
    expect(rollback).toMatch(/voice:sync/);
    expect(rollback).toMatch(/revert/i);
  });
});

describe("documentation claims that the code can check (full audit A15)", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sources(`${dir}/${entry.name}`)
        : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
          ? [read(`${dir}/${entry.name}`)]
          : [],
    );
  const code = sources("src").join("\n");

  it("every ADR is listed in the ADR index", () => {
    const index = read("docs/decisions/README.md");
    const adrs = readdirSync("docs/decisions").filter((f) => /^ADR-\d{3}/.test(f));
    for (const file of adrs) expect(index, file).toContain(`(${file})`);
  });

  it("the security review does not deny what the code does", () => {
    const review = read("docs/05-compliance/SECURITY-REVIEW-2026-10.md");
    if (code.includes("sql.raw(")) expect(review).not.toMatch(/`sql\.raw` yok/);
    if (code.includes("dangerouslySetInnerHTML")) {
      expect(review).not.toMatch(/`dangerouslySetInnerHTML`, `eval`, `new Function` yok/);
    }
  });

  it("the retention doc names the erased patient as the code does", () => {
    const panel = read("src/server/domain/panel.ts");
    const name = /fullName: "([^"]+)",\s*phone: `\$\{ANONYMIZED_PREFIX\}/.exec(panel)?.[1];
    expect(name).toBeDefined();
    expect(read("docs/05-compliance/DATA-RETENTION.md")).toContain(`"${name}"`);
  });
});

describe("documentation names that the code can check (full audit section 6.1)", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const files = (dir: string, pattern: RegExp): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name), pattern)
        : pattern.test(entry.name)
          ? [join(dir, entry.name)]
          : [],
    );

  it("every panel route in PANEL-SPEC exists", () => {
    const routes = new Set(
      files("src/app/panel", /^page\.tsx$/).map(
        (page) =>
          "/" +
          page
            .replaceAll("\\", "/")
            .replace(/^src\/app\//, "")
            .replace(/\/page\.tsx$/, "")
            .replace(/\/\([^)]+\)/g, ""),
      ),
    );
    const documented = [...read("docs/04-panel/PANEL-SPEC.md").matchAll(/`(\/panel[^`\s]*)`/g)].map(
      (m) => m[1]!,
    );
    expect(documented.length).toBeGreaterThan(5);
    for (const route of documented) expect(routes, route).toContain(route);
  });

  it("every tool error code in TOOLS.md is raised somewhere in the code", () => {
    const code = files("src", /\.tsx?$/)
      .filter((f) => !f.includes(".test.") && !f.endsWith("errors.ts"))
      .map(read)
      .join("\n");
    const listed = read("docs/02-voice-agent/TOOLS.md")
      .split("\n")
      .filter((line) => line.includes("Hatalar:"))
      .flatMap((line) => [...line.matchAll(/`([A-Z][A-Z_]+)`/g)].map((m) => m[1]!));
    expect(listed.length).toBeGreaterThan(5);
    for (const name of listed) expect(code, name).toContain(`"${name}"`);
  });

  it("every require…() guard named in the docs exists", () => {
    const code = files("src", /\.tsx?$/)
      .map(read)
      .join("\n");
    const named = new Set(
      files("docs", /\.md$/).flatMap((doc) =>
        [...read(doc).matchAll(/\b(require[A-Z][A-Za-z]+)\(/g)].map((m) => m[1]!),
      ),
    );
    for (const guard of named) {
      expect(code, guard).toMatch(new RegExp(`(function|const) ${guard}\\b`));
    }
  });
});

describe("decision records and architecture docs match the repository (full audit section 6.1)", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const firstWord = (text: string) =>
    text
      .replace(/[*_`]/g, "")
      .trim()
      .split(/[\s:;(]/)[0]!;

  it("the ADR index shows each ADR's own status", () => {
    const index = read("docs/decisions/README.md");
    for (const file of readdirSync("docs/decisions").filter((f) => /^ADR-\d{3}/.test(f))) {
      const own = /Durum(?::\*\*|\s*\|)\s*([^|\n]+)/.exec(read(join("docs/decisions", file)))?.[1];
      const row = index.split("\n").find((line) => line.includes(`(${file})`));
      const listed = row?.split("|").at(-2);
      expect(own, file).toBeDefined();
      expect(firstWord(listed ?? ""), file).toBe(firstWord(own!));
    }
  });

  it("source paths named in decisions and architecture docs exist", () => {
    const docs = [
      ...readdirSync("docs/decisions").map((f) => join("docs/decisions", f)),
      ...readdirSync("docs/01-architecture").map((f) => join("docs/01-architecture", f)),
    ].filter((f) => f.endsWith(".md"));
    for (const doc of docs) {
      for (const [, path] of read(doc).matchAll(/`(src\/[^`*\s]+)`/g)) {
        expect(statSync(path!, { throwIfNoEntry: false }), `${doc}: ${path}`).toBeDefined();
      }
    }
  });

  it("DATA-MODEL does not describe a column the code never writes as if it were filled", () => {
    const written = /kvkkNoticeAt: (?!null)/.test(read("src/server/domain/panel.ts"));
    if (!written) {
      expect(read("docs/01-architecture/DATA-MODEL.md")).not.toMatch(
        /\| kvkk_notice_at \| Aydınlatma anonsunun dinletildiği ilk arama zamanı \|/,
      );
    }
  });
});
