import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { inject } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { ClinicSettingsInput } from "@/server/domain/clinic-settings";
import { parseClinicSettings } from "@/server/domain/clinic-settings";
import type { ClinicContext } from "@/server/domain/clinics";

/**
 * In-process PostgreSQL (PGlite) with the real migrations applied, so
 * integration tests exercise actual SQL and constraints without Docker.
 */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  // Start from the database migrated once in src/test/global-setup.ts.
  const snapshot = inject("pgliteSnapshot");
  const client = snapshot
    ? new PGlite({
        extensions: { btree_gist },
        loadDataDir: new Blob([readFileSync(snapshot)]),
      })
    : new PGlite({ extensions: { btree_gist } });
  const pglite = drizzle({ client, schema, casing: "snake_case" });
  if (!snapshot) await migrate(pglite, { migrationsFolder: "./drizzle" });
  // Same query builder API; only the driver differs.
  return { db: pglite as unknown as Database, close: () => client.close() };
}

let counter = 0;

export interface TestClinic {
  ctx: ClinicContext;
  practitionerId: string;
  serviceId: string;
  phoneNumber: string;
  /** Retell agent id linked to this clinic, as if `voice:sync` had run. */
  agentId: string;
}

/** A clinic open weekdays 09:00–17:00 with one practitioner and a 30-minute service. */
export async function createTestClinic(
  db: Database,
  overrides: {
    settings?: ClinicSettingsInput;
    phoneNumber?: string;
    transferPhoneNumber?: string;
  } = {},
): Promise<TestClinic> {
  counter += 1;
  const settings: ClinicSettingsInput = overrides.settings ?? {
    booking: { minNoticeMinutes: 0, slotIntervalMinutes: 30 },
  };
  const [clinic] = await db
    .insert(schema.clinics)
    .values({
      slug: `test-clinic-${counter}`,
      name: `Test Kliniği ${counter}`,
      transferPhoneNumber: overrides.transferPhoneNumber ?? null,
      settings,
    })
    .returning();
  const phoneNumber = overrides.phoneNumber ?? `+90212000${String(counter).padStart(4, "0")}`;
  const agentId = `agent_test_${counter}`;
  await db
    .insert(schema.phoneNumbers)
    .values({ clinicId: clinic.id, e164: phoneNumber, provider: "retell" });
  await db.insert(schema.voiceAgents).values({
    clinicId: clinic.id,
    provider: "retell",
    externalAgentId: agentId,
    externalLlmId: `llm_test_${counter}`,
    agentVersion: 0,
    status: "synced",
  });
  const [practitioner] = await db
    .insert(schema.practitioners)
    .values({ clinicId: clinic.id, name: "Can Demir", title: "Dt." })
    .returning();
  const [service] = await db
    .insert(schema.services)
    .values({ clinicId: clinic.id, name: "Muayene", durationMinutes: 30 })
    .returning();
  await db.insert(schema.workingHours).values(
    [1, 2, 3, 4, 5].map((weekday) => ({
      clinicId: clinic.id,
      weekday,
      startTime: "09:00",
      endTime: "17:00",
    })),
  );

  return {
    ctx: { clinic, settings: parseClinicSettings(clinic.settings) },
    practitionerId: practitioner.id,
    serviceId: service.id,
    phoneNumber,
    agentId,
  };
}
