import "server-only";

import { z } from "zod";

import { requirePhone } from "../../domain/appointments";
import { createCallbackRequest, markCallOutcome } from "../../domain/calls";
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

    await createCallbackRequest(ctx.db, {
      clinicId: ctx.clinic.clinic.id,
      callId: ctx.callId,
      reason: input.reason,
      patientName: input.patientName,
      phone: phoneNumber,
    });
    if (ctx.callId) await markCallOutcome(ctx.db, ctx.clinic.clinic.id, ctx.callId, "callback");

    return { ok: true, hint: "Hastaya klinik ekibinin en kısa sürede geri arayacağını söyle." };
  },
});
