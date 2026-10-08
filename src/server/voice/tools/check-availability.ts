import "server-only";

import { z } from "zod";

import { pickSpreadSlots } from "../../domain/availability";
import { findAvailability } from "../../domain/scheduling";
import { spokenDate, spokenTime, spokenTitles } from "../../domain/speech";
import { timeToMinutes } from "../../domain/time";
import { defineTool } from "./define";
import { entityId, localDate, localTime } from "./schemas";

const MAX_OFFERED_SLOTS = 6;
const NEAREST_OFFERED = 3;

export const checkAvailability = defineTool({
  name: "check_availability",
  description:
    "Bir hizmet için belirli bir gündeki uygun randevu saatlerini getirir. Saat önermeden önce mutlaka çağır; asla tahminle saat söyleme. Yalnızca hastanın açıkça istediği hizmet için çağır; hizmet belirsizse önce hastaya sor. Hasta belirli bir saat söylediyse onu time olarak gönder.",
  fillerMessage: "Hemen takvime bakıyorum.",
  input: z.object({
    serviceId: entityId("Hizmet"),
    date: localDate,
    time: localTime
      .optional()
      .describe(
        "Hastanın istediği saat, SS:dd (ör. 14:00). Hasta belirli bir saat söylediyse gönder",
      ),
    practitionerId: entityId("Hekim").optional().describe("Hasta belirli bir hekim istediyse"),
    timeOfDay: z
      .enum(["morning", "afternoon", "evening", "any"])
      .optional()
      .describe("Hasta sabah (morning), öğleden sonra (afternoon) veya akşam (evening) dediyse"),
  }),
  async handler(ctx, input) {
    const { time, ...query } = input;
    const result = await findAvailability(ctx.db, ctx.clinic, { ...query, now: ctx.now });
    const toSlot = (slot: (typeof result.slots)[number]) => ({
      time: slot.time,
      spokenTime: spokenTime(slot.time),
      practitionerId: slot.practitionerId,
      practitionerName: spokenTitles(slot.practitionerName),
    });

    // A named time: say whether it is free, in words, so the assistant never
    // reads digits back itself ("11:00" came out as "on bir sıfır sıfır").
    const exact = time ? result.slots.find((slot) => slot.time === time) : undefined;
    const offered = time
      ? exact
        ? [exact]
        : [...result.slots]
            .sort(
              (a, b) =>
                Math.abs(timeToMinutes(a.time) - timeToMinutes(time)) -
                Math.abs(timeToMinutes(b.time) - timeToMinutes(time)),
            )
            .slice(0, NEAREST_OFFERED)
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
      : pickSpreadSlots(result.slots, MAX_OFFERED_SLOTS);

    return {
      ok: true,
      service: result.service.name,
      date: input.date,
      spokenDate: spokenDate(input.date),
      ...(time
        ? { requestedTime: { time, spokenTime: spokenTime(time), available: Boolean(exact) } }
        : {}),
      slots: offered.map(toSlot),
      nextAvailableDates: result.nextAvailableDates.map((date) => ({
        date,
        spokenDate: spokenDate(date),
      })),
      hint: time
        ? exact
          ? "İstenen saat uygun: requestedTime.spokenTime ile söyle ve hastanın onayını al; başka seçenek sunma."
          : offered.length > 0
            ? "İstenen saat dolu: bunu requestedTime.spokenTime ile söyle ve slots içindeki en yakın saatleri spokenTime ile sun."
            : "Bu gün uygun saat yok; nextAvailableDates içindeki günleri öner."
        : offered.length > 0
          ? "Hastaya en fazla 3 seçenek sun. Saatleri spokenTime ile söyle; time alanını sadece tool argümanlarında kullan."
          : "Bu gün uygun saat yok; nextAvailableDates içindeki günleri öner.",
    };
  },
});
