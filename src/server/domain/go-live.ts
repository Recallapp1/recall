import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import type { Env } from "@/lib/env";

import type { Executor } from "../db";
import {
  clinics,
  phoneNumbers,
  practitioners,
  providerDeletions,
  services,
  voiceAgents,
  workingHours,
} from "../db/schema";
import { jobHealth } from "./job-runs";

export type GoLiveState = "ok" | "warn" | "off";

export interface GoLiveCheck {
  label: string;
  state: GoLiveState;
  detail: string;
}

/** The on/off switches whose state the owner should know before go-live. */
const SWITCHES = [
  { key: "POST_CALL_FLAGS", label: "Arama işaretleri" },
  { key: "VOICE_TOOL_IDEMPOTENCY", label: "Tekrarlanan istek koruması" },
  { key: "VOICE_TOOL_FAILSAFE", label: "Sistem hatasında dürüst yanıt" },
  { key: "AUDIT_STRICT", label: "Sıkı denetim kaydı" },
  { key: "VOICE_SHARED_NUMBER_CHECK", label: "Ortak numara doğrulaması" },
  { key: "PATIENTS_PER_NAME", label: "Aile bireylerine ayrı kayıt" },
  { key: "PANEL_PATIENT_EDIT", label: "Hasta bilgisi düzeltme" },
  { key: "VOICE_PROMPT_HARDENING", label: "Güçlendirilmiş asistan metni" },
  { key: "DELETION_QUEUE_HOURLY", label: "Saatlik silme kuyruğu" },
  { key: "HOURLY_REMINDERS", label: "Saatlik hatırlatmalar" },
  { key: "CALL_REVIEW", label: "Asistan hatası bildirme" },
  { key: "TEST_CALL_FLAG", label: "Test araması işareti" },
  { key: "PANEL_LIMITS_VIEW", label: "Kullanım ve sınırlar sayfası" },
] as const satisfies readonly { key: keyof Env; label: string }[];

/**
 * Read-only go-live check for one clinic (R2 5c): what is connected and
 * which switches are on. No personal data; numbers are counts.
 */
export async function goLiveChecks(
  exec: Executor,
  clinicId: string,
  config: Pick<Env, "SMS_SENDING_ENABLED" | "SMS_PROVIDER" | (typeof SWITCHES)[number]["key"]> &
    Partial<Pick<Env, "PANEL_TWO_FACTOR" | "PANEL_SESSION_HOURS">>,
): Promise<{ checks: GoLiveCheck[]; switches: { label: string; on: boolean }[] }> {
  const total = async (query: Promise<{ value: number }[]>) => (await query)[0]?.value ?? 0;
  const [clinic] = await exec
    .select({ status: clinics.status })
    .from(clinics)
    .where(eq(clinics.id, clinicId));
  const [agent] = await exec
    .select({ status: voiceAgents.status, syncedAt: voiceAgents.syncedAt })
    .from(voiceAgents)
    .where(eq(voiceAgents.clinicId, clinicId));
  const [lines, hours, staff, offered, queued] = await Promise.all([
    total(
      exec
        .select({ value: count() })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.clinicId, clinicId), eq(phoneNumbers.isActive, true))),
    ),
    total(
      exec.select({ value: count() }).from(workingHours).where(eq(workingHours.clinicId, clinicId)),
    ),
    total(
      exec
        .select({ value: count() })
        .from(practitioners)
        .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.isActive, true))),
    ),
    total(exec.select({ value: count() }).from(services).where(eq(services.clinicId, clinicId))),
    total(
      exec
        .select({ value: count() })
        .from(providerDeletions)
        .where(and(eq(providerDeletions.clinicId, clinicId), isNull(providerDeletions.doneAt))),
    ),
  ]);
  const smsOn = config.SMS_SENDING_ENABLED && config.SMS_PROVIDER === "netgsm";

  const checks: GoLiveCheck[] = [
    {
      label: "Klinik durumu",
      state: clinic?.status === "active" ? "ok" : "warn",
      detail: clinic?.status === "active" ? "Aktif" : "Duraklatılmış: asistan randevu almıyor",
    },
    {
      label: "Telefon hattı",
      state: lines > 0 ? "ok" : "warn",
      detail: lines > 0 ? `${lines} numara bağlı` : "Bağlı numara yok",
    },
    {
      label: "Asistan",
      state: agent?.status === "synced" ? "ok" : "warn",
      detail:
        agent?.status === "synced"
          ? `Güncel${agent.syncedAt ? ` (${agent.syncedAt.toISOString().slice(0, 10)})` : ""}`
          : "Senkronize değil",
    },
    {
      label: "Çalışma saatleri, hekim ve hizmet",
      state: hours > 0 && staff > 0 && offered > 0 ? "ok" : "warn",
      detail: `${hours} saat aralığı, ${staff} hekim, ${offered} hizmet`,
    },
    {
      label: "SMS",
      state: smsOn ? "ok" : "off",
      detail: smsOn ? "Gerçek gönderim açık" : "Kapalı: hiçbir SMS gönderilmez",
    },
    {
      label: "Silme kuyruğu (KVKK)",
      state: queued === 0 ? "ok" : "warn",
      detail:
        queued === 0 ? "Bekleyen silme yok" : `${queued} kayıt sağlayıcıda silinmeyi bekliyor`,
    },
  ];
  if (config.HOURLY_REMINDERS === true) {
    const [hourly] = await jobHealth(exec, new Date(), { hourlyReminders: true }).then((jobs) =>
      jobs.filter((job) => job.job === "reminders"),
    );
    checks.push({
      label: "Saatlik hatırlatmalar",
      state: hourly?.healthy ? "ok" : "warn",
      detail: hourly?.healthy
        ? "Saatlik iş çalışıyor"
        : "Saatlik iş son 2,5 saatte çalışmadı: vercel.json'daki saatlik cron kaydı eksik olabilir; hatırlatma gitmez",
    });
  }
  const policy = config.PANEL_TWO_FACTOR ?? "off";
  const sessionHours = config.PANEL_SESSION_HOURS;
  const switches = [
    ...SWITCHES.map(({ key, label }) => ({ label, on: config[key] === true })),
    {
      label: `İki adımlı giriş: ${policy === "off" ? "kapalı" : policy}`,
      on: policy !== "off",
    },
    {
      label: `Panel oturum süresi: ${sessionHours === undefined ? "7 gün" : `${sessionHours} saat`}`,
      on: sessionHours !== undefined,
    },
  ];
  return { checks, switches };
}
