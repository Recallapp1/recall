import { z } from "zod";

import { isLocalDate, isLocalTime } from "../../domain/time";

/** Shared argument schemas; descriptions are part of the prompt the LLM sees. */

export const localDate = z
  .string()
  .refine(isLocalDate, "Tarih YYYY-AA-GG biçiminde olmalı")
  .describe("Klinik yerel tarihi, YYYY-AA-GG (ör. 2026-11-05)");

export const localTime = z
  .string()
  .refine(isLocalTime, "Saat SS:dd biçiminde olmalı")
  .describe("Klinik yerel saati, SS:dd (ör. 14:30)");

export const entityId = (what: string) =>
  z.uuid().describe(`${what} id'si (klinik bilgilerindeki id)`);

export const phone = z
  .string()
  .min(7)
  .max(20)
  .describe(
    'Hastanın telefon numarası, hastanın söylediği gruplarla rakamla yaz (ör. "0532 123 45 67"); sıfırla başlayan on bir hane olmalı. Sadece arayan numara bilinmiyorsa sor ve gönder.',
  );
