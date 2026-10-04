/**
 * Demo data for local development: `pnpm db:seed [--phone +1XXXXXXXXXX]`.
 * Idempotent — the demo clinic is deleted (cascading) and recreated.
 * Runs under tsx, so it must not import `server-only` modules.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { normalizePhone } from "../../lib/phone";
import type { ClinicSettingsInput } from "../domain/clinic-settings";
import { addLocalDays, isoWeekday, localToday, localToUtc, timeToMinutes } from "../domain/time";
import * as schema from "./schema";

config({ path: [".env.local", ".env"], quiet: true });

const DEMO_SLUG = "gulus-dis";
const TIME_ZONE = "Europe/Istanbul";

function phoneArg(): string {
  const index = process.argv.indexOf("--phone");
  const raw = index > -1 ? process.argv[index + 1] : "+902120000000";
  const phone = normalizePhone(raw);
  if (!phone) throw new Error(`Invalid --phone value: ${raw}`);
  return phone;
}

const settings: ClinicSettingsInput = {
  assistant: {
    name: "Elif",
    speakPrices: false,
    recordCalls: true,
    faq: [
      { q: "Otopark var mı?", a: "Binanın arkasında ücretsiz otopark var." },
      {
        q: "Kredi kartı geçiyor mu?",
        a: "Evet, tüm kredi kartları geçerli; taksit seçenekleri var.",
      },
    ],
    extraInstructions: "İmplant soran hastalara önce implant görüşmesi randevusu öner.",
  },
  booking: {
    slotIntervalMinutes: 15,
    minNoticeMinutes: 60,
    maxDaysAhead: 45,
    cancellationMinNoticeHours: 12,
    allowPractitionerChoice: true,
  },
};

const serviceCatalog = [
  {
    name: "Muayene / Kontrol",
    durationMinutes: 20,
    aliases: ["muayene", "kontrol", "ağrı", "bakılması"],
    price: [50000, 100000],
  },
  {
    name: "Diş Taşı Temizliği",
    durationMinutes: 30,
    aliases: ["temizlik", "detertraj", "taş"],
    price: [150000, 250000],
  },
  { name: "Dolgu", durationMinutes: 45, aliases: ["dolgu", "çürük"], price: [200000, 400000] },
  { name: "Kanal Tedavisi", durationMinutes: 60, aliases: ["kanal"], price: [500000, 900000] },
  {
    name: "Diş Çekimi",
    durationMinutes: 30,
    aliases: ["çekim", "çektirmek"],
    price: [100000, 300000],
  },
  {
    name: "İmplant Görüşmesi",
    durationMinutes: 30,
    aliases: ["implant", "vida"],
    price: [null, null],
  },
  {
    name: "Diş Beyazlatma",
    durationMinutes: 60,
    aliases: ["beyazlatma", "bleaching"],
    price: [400000, 700000],
  },
] as const;

async function main() {
  const phoneNumber = phoneArg();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  try {
    await db.transaction(async (tx) => {
      // Keep the link to the remote Retell agent across reseeds; otherwise the
      // next `voice:sync` would create a duplicate agent on Retell.
      const [previous] = await tx
        .select({ agent: schema.voiceAgents })
        .from(schema.voiceAgents)
        .innerJoin(schema.clinics, eq(schema.clinics.id, schema.voiceAgents.clinicId))
        .where(eq(schema.clinics.slug, DEMO_SLUG));

      await tx.delete(schema.clinics).where(eq(schema.clinics.slug, DEMO_SLUG));
      // Free the number if another local clinic was using it.
      await tx.delete(schema.phoneNumbers).where(eq(schema.phoneNumbers.e164, phoneNumber));

      const [clinic] = await tx
        .insert(schema.clinics)
        .values({
          slug: DEMO_SLUG,
          name: "Gülüş Diş Kliniği",
          timezone: TIME_ZONE,
          transferPhoneNumber: null,
          address: "Moda Caddesi No:12, Kadıköy, İstanbul",
          settings,
        })
        .returning();

      await tx
        .insert(schema.phoneNumbers)
        .values({ clinicId: clinic.id, e164: phoneNumber, provider: "retell" });

      if (previous) {
        const { externalAgentId, externalLlmId, agentVersion, provider } = previous.agent;
        // Spec hash is dropped so the next sync pushes the reseeded data.
        await tx.insert(schema.voiceAgents).values({
          clinicId: clinic.id,
          provider,
          externalAgentId,
          externalLlmId,
          agentVersion,
          status: "pending",
        });
      }

      const [can, elif] = await tx
        .insert(schema.practitioners)
        .values([
          { clinicId: clinic.id, name: "Can Demir", title: "Dt." },
          { clinicId: clinic.id, name: "Elif Kaya", title: "Dt." },
        ])
        .returning();

      const services = await tx
        .insert(schema.services)
        .values(
          serviceCatalog.map((s) => ({
            clinicId: clinic.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            aliases: [...s.aliases],
            priceMin: s.price[0],
            priceMax: s.price[1],
          })),
        )
        .returning();

      // Only Dt. Can performs root canals and implants; every other service is open to both.
      const canOnly = services.filter((s) =>
        ["Kanal Tedavisi", "İmplant Görüşmesi"].includes(s.name),
      );
      await tx
        .insert(schema.practitionerServices)
        .values(canOnly.map((s) => ({ practitionerId: can.id, serviceId: s.id })));

      // Clinic hours: weekdays with a lunch break, Saturday mornings.
      const clinicHours = [1, 2, 3, 4, 5].flatMap((weekday) => [
        { weekday, startTime: "09:00", endTime: "12:30" },
        { weekday, startTime: "13:30", endTime: "18:00" },
      ]);
      clinicHours.push({ weekday: 6, startTime: "10:00", endTime: "14:00" });
      await tx
        .insert(schema.workingHours)
        .values(clinicHours.map((h) => ({ ...h, clinicId: clinic.id, practitionerId: null })));

      // Dt. Can works Monday, Wednesday and Friday; Dt. Elif follows clinic hours.
      await tx.insert(schema.workingHours).values(
        [1, 3, 5].map((weekday) => ({
          clinicId: clinic.id,
          practitionerId: can.id,
          weekday,
          startTime: "09:00",
          endTime: "18:00",
        })),
      );

      // One existing appointment on the next weekday, so availability has something to avoid.
      const today = localToday(new Date(), TIME_ZONE);
      let date = addLocalDays(today, 1);
      while (isoWeekday(date) > 5) date = addLocalDays(date, 1);
      const cleaning = services.find((s) => s.name === "Diş Taşı Temizliği")!;
      const [patient] = await tx
        .insert(schema.patients)
        .values({ clinicId: clinic.id, fullName: "Ayşe Yılmaz", phone: "+905321234567" })
        .returning();
      const startsAt = localToUtc(date, timeToMinutes("10:00"), TIME_ZONE);
      await tx.insert(schema.appointments).values({
        clinicId: clinic.id,
        patientId: patient.id,
        practitionerId: elif.id,
        serviceId: cleaning.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + cleaning.durationMinutes * 60_000),
        source: "panel",
      });

      console.info(`Seeded "${clinic.name}" (${clinic.id}) on ${phoneNumber}`);
      console.info(`  practitioners: ${can.title} ${can.name}, ${elif.title} ${elif.name}`);
      console.info(`  services: ${services.length}, sample appointment: ${date} 10:00`);
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
