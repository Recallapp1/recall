import "server-only";

import { z } from "zod";

import { normalizePhone } from "@/lib/phone";

import { DomainError } from "../../domain/errors";
import {
  findUpcomingAppointments,
  isSharedNumber,
  type OwnershipCheck,
} from "../../domain/appointments";
import { consumeRateLimit, hashKey, isRateLimited } from "../../domain/rate-limit";
import type { ToolContext } from "./define";
import { localDate, localTime } from "./schemas";

/**
 * Who may see or change which appointments on a call.
 *
 * - Caller ID known (real phone call): the network-supplied number is the
 *   identity. A number the caller speaks is ignored for lookups and changes,
 *   otherwise anyone could manage a stranger's appointments by saying their number.
 * - Caller ID hidden or absent (withheld numbers, browser test calls): a spoken
 *   number alone proves nothing. Nothing is disclosed or changed until the caller
 *   also states the patient's full name and the appointment's date and time.
 *   Failed checks are counted per call and per number, then locked.
 */

export const ownershipCheck = z
  .object({
    patientName: z.string().min(2).max(100).describe("Randevunun kayıtlı olduğu ad soyad"),
    appointmentDate: localDate.describe("Hastanın söylediği randevu tarihi, YYYY-AA-GG"),
    appointmentTime: localTime.describe("Hastanın söylediği randevu saati, SS:dd"),
  })
  .describe(
    "Arayan numara görünmüyorsa zorunlu: hastanın kendisinin söylediği ad soyad, randevu tarihi ve saati. Bu bilgileri hastaya sen söyleme.",
  );

/** Failed ownership checks allowed per call, and per spoken number per day. */
export const VERIFY_LIMIT_PER_CALL = { limit: 3, windowMs: 2 * 60 * 60 * 1000 };
export const VERIFY_LIMIT_PER_NUMBER = { limit: 5, windowMs: 24 * 60 * 60 * 1000 };

export type CallerIdentity =
  | { trusted: true; phone: string; ignoredSpokenNumber: boolean }
  | { trusted: false; phone: string | null };

export function resolveCaller(ctx: ToolContext, spokenPhone: string | undefined): CallerIdentity {
  if (ctx.callerPhone) {
    const spoken = normalizePhone(spokenPhone);
    return {
      trusted: true,
      phone: ctx.callerPhone,
      ignoredSpokenNumber: Boolean(spokenPhone?.trim()) && spoken !== ctx.callerPhone,
    };
  }
  return { trusted: false, phone: spokenPhone ?? null };
}

/**
 * Whether this caller must prove ownership (name, date, time): always without
 * caller ID, and with VOICE_SHARED_NUMBER_CHECK also when the caller's number
 * holds appointments for more than one person.
 */
export async function needsOwnershipCheck(
  ctx: ToolContext,
  caller: CallerIdentity,
): Promise<boolean> {
  if (!caller.trusted) return true;
  if (!ctx.sharedNumberCheck) return false;
  const upcoming = await findUpcomingAppointments(ctx.db, ctx.clinic, caller.phone, ctx.now);
  return isSharedNumber(upcoming);
}

function limitKeys(ctx: ToolContext, phone: string | null) {
  const clinicId = ctx.clinic.clinic.id;
  return {
    call: `voice-verify:call:${clinicId}:${ctx.callId ?? "none"}`,
    number: `voice-verify:number:${hashKey(clinicId, normalizePhone(phone) ?? phone ?? "")}`,
  };
}

/**
 * Runs an ownership-checked operation for a caller without caller ID. A
 * failed check counts against the call and the number; once either is used
 * up, even a correct answer is refused for the rest of the window.
 */
export async function withOwnershipCheck<T>(
  ctx: ToolContext,
  phone: string | null,
  check: OwnershipCheck | undefined,
  run: (check: OwnershipCheck) => Promise<T>,
): Promise<T> {
  if (!check) {
    throw new DomainError(
      "VERIFICATION_REQUIRED",
      "Arayan numara görünmediği için önce randevunun kayıtlı olduğu ad soyadı, randevu tarihini ve saatini hastadan iste.",
    );
  }
  const keys = limitKeys(ctx, phone);
  const locked =
    (await isRateLimited(ctx.db, keys.call, VERIFY_LIMIT_PER_CALL, ctx.now)) ||
    (await isRateLimited(ctx.db, keys.number, VERIFY_LIMIT_PER_NUMBER, ctx.now));
  if (locked) throw tooManyAttempts();

  try {
    return await run(check);
  } catch (error) {
    if (
      error instanceof DomainError &&
      (error.code === "VERIFICATION_FAILED" || error.code === "NOT_FOUND")
    ) {
      await consumeRateLimit(ctx.db, keys.call, VERIFY_LIMIT_PER_CALL, ctx.now);
      await consumeRateLimit(ctx.db, keys.number, VERIFY_LIMIT_PER_NUMBER, ctx.now);
      // Same answer whether the number, the name or the date was wrong.
      throw new DomainError(
        "VERIFICATION_FAILED",
        "Söylediğiniz bilgilerle eşleşen bir randevu bulamadım. Bilgileri bir kez daha kontrol edebilir misiniz? Olmazsa klinik ekibinin sizi geri aramasını sağlayabilirim.",
      );
    }
    throw error;
  }
}

function tooManyAttempts() {
  return new DomainError(
    "TOO_MANY_ATTEMPTS",
    "Güvenliğiniz için bu görüşmede randevu bilgilerine erişemiyorum. Klinik ekibinin sizi geri araması için not bırakabilirim.",
  );
}
