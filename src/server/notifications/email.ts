import "server-only";

import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";

import { raiseAlarm } from "../observability/alarm";

/**
 * Transactional email behind an adapter (ADR-006). Emails never contain
 * patient data: only the clinic name, the inviter's name and one-time links.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** "elif.kaya@ornek.com" → "e***@ornek.com" for logs. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Local development: nothing is sent. The text body is printed so one-time
 * links (password, invitation) can be opened from the terminal. In production
 * those links are credentials: the provider refuses and alarms instead of
 * writing them to the logs (full audit FA-30).
 */
class ConsoleEmailProvider implements EmailProvider {
  constructor(private readonly production: boolean) {}

  async send({ to, subject, text }: EmailMessage) {
    if (this.production) {
      raiseAlarm("email.console_in_production", { subject });
      throw new Error("EMAIL_PROVIDER=console cannot send in production");
    }
    console.info(`[email:console] to=${maskEmail(to)} subject="${subject}"\n${text}`);
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send({ to, subject, html, text }: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed: http=${response.status}`);
    }
  }
}

let provider: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (provider) return provider;
  const config = env();
  provider =
    config.EMAIL_PROVIDER === "resend"
      ? new ResendEmailProvider(config.RESEND_API_KEY!, config.EMAIL_FROM)
      : new ConsoleEmailProvider(config.NODE_ENV === "production");
  return provider;
}

/** For tests: capture emails instead of sending them. */
export function setEmailProvider(next: EmailProvider | undefined) {
  provider = next;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await emailProvider().send(message);
  } catch (error) {
    console.error(`[email] send failed to=${maskEmail(message.to)}`, safeError(error));
    throw error;
  }
}
