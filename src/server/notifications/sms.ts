import "server-only";

import { env } from "@/lib/env";
import { maskPhone } from "@/lib/phone";

import { displayDate } from "../domain/time";
import type { AppointmentSummary } from "../domain/appointments";

export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

/** Local development: never sends, logs a masked preview. */
class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, body: string) {
    console.info(`[sms:console] to=${maskPhone(to)} chars=${body.length}\n${body}`);
  }
}

/**
 * Netgsm REST v2. Verify the endpoint and payload against Netgsm's current
 * documentation before enabling `SMS_PROVIDER=netgsm` in production.
 */
class NetgsmSmsProvider implements SmsProvider {
  constructor(
    private readonly usercode: string,
    private readonly password: string,
    private readonly header: string,
  ) {}

  async send(to: string, body: string) {
    // Netgsm expects Turkish mobiles without the country code: 5XXXXXXXXX
    const number = to.startsWith("+90") ? to.slice(3) : to.replace(/^\+/, "");
    const response = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${this.usercode}:${this.password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        msgheader: this.header,
        encoding: "TR",
        messages: [{ msg: body, no: number }],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json().catch(() => ({}))) as { code?: string };
    if (!response.ok || result.code !== "00") {
      throw new Error(`Netgsm send failed: http=${response.status} code=${result.code ?? "?"}`);
    }
  }
}

let provider: SmsProvider | undefined;

export function smsProvider(): SmsProvider {
  if (provider) return provider;
  const config = env();
  provider =
    config.SMS_PROVIDER === "netgsm"
      ? new NetgsmSmsProvider(
          config.NETGSM_USERCODE!,
          config.NETGSM_PASSWORD!,
          config.NETGSM_HEADER!,
        )
      : new ConsoleSmsProvider();
  return provider;
}

// ─── Message templates (docs/03-telephony/NOTIFICATIONS.md) ─────────────────

export const smsTemplates = {
  confirmation: (clinicName: string, a: AppointmentSummary, address?: string | null) =>
    `${clinicName}: Sayın ${a.patientName}, ${displayDate(a.date)} ${a.time} tarihli ${a.serviceName} randevunuz oluşturuldu.` +
    (address ? ` Adres: ${address}.` : "") +
    ` Değişiklik için bu numarayı arayabilirsiniz.`,

  cancellation: (clinicName: string, a: AppointmentSummary) =>
    `${clinicName}: ${displayDate(a.date)} ${a.time} tarihli randevunuz iptal edilmiştir. Yeni randevu için bizi arayabilirsiniz.`,

  rescheduled: (clinicName: string, a: AppointmentSummary) =>
    `${clinicName}: Randevunuz ${displayDate(a.date)} ${a.time} olarak güncellenmiştir.`,
};

/** Sends without throwing: an SMS failure must never undo or fail a booking. */
export async function sendSmsSafely(to: string, body: string, context: Record<string, unknown>) {
  try {
    await smsProvider().send(to, body);
  } catch (error) {
    console.error("sms.failed", {
      ...context,
      error: error instanceof Error ? error.message : error,
    });
  }
}
