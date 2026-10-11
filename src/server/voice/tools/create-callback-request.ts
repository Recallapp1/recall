import "server-only";

import { z } from "zod";

import { requirePhone } from "../../domain/appointments";
import { createCallbackRequest, markCallOutcome } from "../../domain/calls";
import { DomainError } from "../../domain/errors";
import { allow } from "../../security/rate-limits";
import { defineTool } from "./define";
import { phone } from "./schemas";

export const createCallbackRequestTool = defineTool({
  name: "create_callback_request",
  description:
    "Klinik ekibinin hastayı geri araması için not bırakır. Hasta insanla görüşmek istediğinde ve aktarım mümkün değilse, ya da bilmediğin bir konu sorulduğunda kullan.",
  fillerMessage: "Notunuzu alıyorum.",
  input: z.object({
    reason: z.string().min(3).max(500).describe("Geri aranma sebebi, kısa ve net"),
    patientName: z.string().max(100).optional(),
    phone: phone.optional(),
  }),
  async handler(ctx, input) {
    const phoneNumber = requirePhone(
      input.phone ?? ctx.callerPhone,
      "Sizi geri arayabilmemiz için telefon numaranız gerekiyor.",
    );

    const clinicId = ctx.clinic.clinic.id;
    const request = {
      clinicId,
      callId: ctx.callId,
      reason: input.reason,
      patientName: input.patientName,
      phone: phoneNumber,
    };
    const limits = { exec: ctx.db, now: ctx.now };
    const existing = await createCallbackRequest(ctx.db, request, { onlyIfExisting: true });
    if (!existing) {
      const allowed =
        (await allow("callbackPerCall", [clinicId, ctx.callId ?? "none"], limits)) &&
        (await allow("callbackPerNumber", [clinicId, phoneNumber], limits));
      if (!allowed) {
        throw new DomainError(
          "RATE_LIMITED",
          "Bu görüşmede daha fazla geri arama notu bırakamıyorum; ekibimiz mevcut notla sizi arayacak.",
        );
      }
    }
    const note = existing ?? (await createCallbackRequest(ctx.db, request));
    if (ctx.callId) await markCallOutcome(ctx.db, clinicId, ctx.callId, "callback");

    return {
      ok: true,
      alreadyExisted: !note?.created && !note?.appended,
      hint: "Hastaya klinik ekibinin en kısa sürede geri arayacağını söyle.",
    };
  },
});
