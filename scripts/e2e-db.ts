/**
 * Throwaway database for the Playwright suite (e2e/): an in-memory PGlite,
 * migrated and seeded, served over the Postgres protocol on E2E_DB_PORT.
 * Nothing touches Neon. The seeded ids are written to e2e/.fixtures.json.
 *
 *   pnpm e2e:db   (started by playwright.config.ts)
 */
import { writeFileSync } from "node:fs";
import http from "node:http";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../src/server/db/schema";

export const E2E_DB_PORT = Number(process.env.E2E_DB_PORT ?? 5544);
export const E2E_PASSWORD = "e2e-parola-1234567";

async function main() {
  const client = await PGlite.create({ extensions: { btree_gist } });
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });

  const password = await hashPassword(E2E_PASSWORD);

  async function clinic(slug: string, name: string, followUp: boolean) {
    const [organization] = await db.insert(schema.organizations).values({ name, slug }).returning();
    const [row] = await db
      .insert(schema.clinics)
      .values({
        slug,
        name,
        organizationId: organization!.id,
        settings: {
          booking: { minNoticeMinutes: 0, slotIntervalMinutes: 30, maxDaysAhead: 60 },
          features: { followUp },
        },
      })
      .returning();
    const [practitioner] = await db
      .insert(schema.practitioners)
      .values({ clinicId: row!.id, name: "Can Demir", title: "Dt." })
      .returning();
    const [service] = await db
      .insert(schema.services)
      .values({ clinicId: row!.id, name: "Muayene", durationMinutes: 30 })
      .returning();
    // Open every day so the suite can book whatever day it runs.
    await db.insert(schema.workingHours).values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        clinicId: row!.id,
        weekday,
        startTime: "08:00",
        endTime: "20:00",
      })),
    );
    return {
      id: row!.id,
      organizationId: organization!.id,
      practitionerId: practitioner!.id,
      serviceId: service!.id,
    };
  }

  async function user(email: string, name: string, role = "user") {
    const [row] = await db
      .insert(schema.users)
      .values({ email, name, role, emailVerified: true })
      .returning();
    await db
      .insert(schema.accounts)
      .values({ userId: row!.id, accountId: row!.id, providerId: "credential", password });
    return row!.id;
  }

  async function member(
    organizationId: string,
    userId: string,
    role: string,
    practitionerId?: string,
  ) {
    await db.insert(schema.members).values({ organizationId, userId, role, practitionerId });
  }

  const a = await clinic("e2e-a", "Klinik A", true);
  const b = await clinic("e2e-b", "Klinik B", true);
  const c = await clinic("e2e-c", "Klinik C", false);

  const owner = await user("sahip@a.test", "Ayşe Sahip");
  await member(a.organizationId, owner, "owner");
  // The same person also runs clinic C (clinic switcher).
  await member(c.organizationId, owner, "owner");
  const staff = await user("sekreter@a.test", "Sena Sekreter");
  await member(a.organizationId, staff, "staff");
  const doctor = await user("hekim@a.test", "Can Demir");
  await member(a.organizationId, doctor, "practitioner", a.practitionerId);
  const ownerB = await user("sahip@b.test", "Burak Sahip");
  await member(b.organizationId, ownerB, "owner");

  const [patientA] = await db
    .insert(schema.patients)
    .values({ clinicId: a.id, fullName: "Elif Yıldız", phone: "+905321110001" })
    .returning();
  const [followUpPatient] = await db
    .insert(schema.patients)
    .values({ clinicId: a.id, fullName: "Takip Hastası", phone: "+905321110003" })
    .returning();
  await db.insert(schema.followUpRules).values({
    clinicId: a.id,
    name: "Altı aylık kontrol",
    visitServiceId: a.serviceId,
    intervalValue: 6,
    intervalUnit: "month",
    isActive: true,
  });
  const [patientB] = await db
    .insert(schema.patients)
    .values({ clinicId: b.id, fullName: "Gizli Hasta", phone: "+905321110002" })
    .returning();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setUTCHours(9, 0, 0, 0);
  const [appointmentB] = await db
    .insert(schema.appointments)
    .values({
      clinicId: b.id,
      patientId: patientB!.id,
      practitionerId: b.practitionerId,
      serviceId: b.serviceId,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 30 * 60 * 1000),
      source: "panel",
    })
    .returning();

  writeFileSync(
    "e2e/.fixtures.json",
    JSON.stringify(
      {
        password: E2E_PASSWORD,
        users: {
          owner: "sahip@a.test",
          staff: "sekreter@a.test",
          practitioner: "hekim@a.test",
          ownerB: "sahip@b.test",
        },
        clinicA: a,
        clinicB: b,
        clinicC: c,
        patientA: patientA!.id,
        followUpPatient: followUpPatient!.id,
        patientB: patientB!.id,
        appointmentB: appointmentB!.id,
      },
      null,
      2,
    ),
  );

  const server = new PGLiteSocketServer({ db: client, port: E2E_DB_PORT, host: "127.0.0.1" });
  await server.start();
  // Readiness over plain HTTP on IPv4: Playwright's port probe can miss a
  // socket bound to 127.0.0.1 when "localhost" resolves to IPv6 (Linux CI).
  const ready = http
    .createServer((_, res) => res.end("ready"))
    .listen(E2E_DB_PORT + 1, "127.0.0.1");
  console.info(`e2e database ready on 127.0.0.1:${E2E_DB_PORT}`);
  const stop = async () => {
    ready.close();
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
