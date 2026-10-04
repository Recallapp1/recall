import "server-only";

import { z } from "zod";

import { pickSpreadSlots } from "../../domain/availability";
import { findAvailability } from "../../domain/scheduling";
import { spokenDate } from "../../domain/time";
import { defineTool } from "./define";
import { entityId, localDate } from "./schemas";

const MAX_OFFERED_SLOTS = 6;

export const checkAvailability = defineTool({
  name: "check_availability",
  description:
    "Bir hizmet için belirli bir gündeki uygun randevu saatlerini getirir. Saat önermeden önce mutlaka çağır; asla tahminle saat söyleme.",
  fillerMessage: "Hemen takvime bakıyorum.",
  input: z.object({
    serviceId: entityId("Hizmet"),
    date: localDate,
    practitionerId: entityId("Hekim").optional().describe("Hasta belirli bir hekim istediyse"),
    timeOfDay: z
      .enum(["morning", "afternoon", "evening", "any"])
      .optional()
      .describe("Hasta sabah (morning), öğleden sonra (afternoon) veya akşam (evening) dediyse"),
  }),
  async handler(ctx, input) {
    const result = await findAvailability(ctx.db, ctx.clinic, { ...input, now: ctx.now });
    const offered = pickSpreadSlots(result.slots, MAX_OFFERED_SLOTS);

    return {
      ok: true,
      service: result.service.name,
      date: input.date,
      spokenDate: spokenDate(input.date),
      slots: offered.map((slot) => ({
        time: slot.time,
        practitionerId: slot.practitionerId,
        practitionerName: slot.practitionerName,
      })),
      nextAvailableDates: result.nextAvailableDates.map((date) => ({
        date,
        spokenDate: spokenDate(date),
      })),
      hint:
        offered.length > 0
          ? "Hastaya en fazla 3 seçenek sun."
          : "Bu gün uygun saat yok; nextAvailableDates içindeki günleri öner.",
    };
  },
});
