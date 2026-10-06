import { z } from "zod";

/**
 * Follow-up ("Takip") vocabulary shared by the database enums, the domain and
 * the panel (docs/proposals/TAKIP.md, V1).
 */

export const FOLLOW_UP_INTERVAL_UNITS = ["day", "week", "month"] as const;
export type FollowUpIntervalUnit = (typeof FOLLOW_UP_INTERVAL_UNITS)[number];

/** Spoken forms for the sentence editor: "her 6 ayda bir". */
export const INTERVAL_UNIT_LABELS: Record<FollowUpIntervalUnit, string> = {
  day: "gün",
  week: "hafta",
  month: "ay",
};

/** Locative forms (vowel harmony): "her 30 günde bir", "her 6 ayda bir". */
export const INTERVAL_UNIT_LOCATIVE: Record<FollowUpIntervalUnit, string> = {
  day: "günde",
  week: "haftada",
  month: "ayda",
};

/** Upper bounds, mirrored in the follow_up_rules CHECK constraint. */
export const INTERVAL_LIMITS: Record<FollowUpIntervalUnit, number> = {
  day: 730,
  week: 104,
  month: 36,
};
export const TOTAL_VISITS_MAX = 50;

export const FOLLOW_UP_STATES = ["active", "paused", "stopped", "completed"] as const;
export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

export const FOLLOW_UP_VISIT_SOURCES = ["start", "auto_link", "staff_link", "manual"] as const;
export type FollowUpVisitSource = (typeof FOLLOW_UP_VISIT_SOURCES)[number];

export const FOLLOW_UP_STOP_REASONS = [
  "patient_request",
  "treatment_changed",
  "unreachable",
  "other",
] as const;
export type FollowUpStopReason = (typeof FOLLOW_UP_STOP_REASONS)[number];

export const STOP_REASON_LABELS: Record<FollowUpStopReason, string> = {
  patient_request: "Hasta istemedi",
  treatment_changed: "Tedavi değişti",
  unreachable: "Ulaşılamadı",
  other: "Diğer",
};

/** What staff see on the Takip tab; derived, never stored. */
export const FOLLOW_UP_VIEWS = [
  "overdue",
  "due",
  "upcoming",
  "booked",
  "paused",
  "completed",
  "stopped",
] as const;
export type FollowUpView = (typeof FOLLOW_UP_VIEWS)[number];

export const FOLLOW_UP_VIEW_LABELS: Record<FollowUpView, string> = {
  overdue: "Gecikti",
  due: "Zamanı geldi",
  upcoming: "Yaklaşan",
  booked: "Randevulu",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
  stopped: "Bırakıldı",
};

const uuid = z.uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarihi seçin.");

export const followUpRuleSchema = z
  .object({
    name: z.string().trim().min(2, "Kural adı en az 2 karakter.").max(60),
    triggerServiceId: uuid.nullable(),
    visitServiceId: uuid,
    intervalValue: z.number().int().positive().nullable(),
    intervalUnit: z.enum(FOLLOW_UP_INTERVAL_UNITS).nullable(),
    totalVisits: z
      .number()
      .int()
      .min(1, "Toplam ziyaret en az 1.")
      .max(TOTAL_VISITS_MAX, `Toplam ziyaret en fazla ${TOTAL_VISITS_MAX}.`)
      .nullable(),
    smsReminders: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((rule, ctx) => {
    if ((rule.intervalValue === null) !== (rule.intervalUnit === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalValue"],
        message: "Aralığı ve birimini birlikte seçin.",
      });
      return;
    }
    if (rule.intervalValue !== null && rule.intervalUnit !== null) {
      const max = INTERVAL_LIMITS[rule.intervalUnit];
      if (rule.intervalValue > max) {
        ctx.addIssue({
          code: "custom",
          path: ["intervalValue"],
          message: `En fazla ${max} ${INTERVAL_UNIT_LABELS[rule.intervalUnit]}.`,
        });
      }
    }
    if (rule.isActive && rule.intervalValue === null) {
      ctx.addIssue({
        code: "custom",
        path: ["isActive"],
        message: "Aralığı belirlenmemiş kural etkinleştirilemez.",
      });
    }
  });
export type FollowUpRuleInput = z.infer<typeof followUpRuleSchema>;

export const startPlanSchema = z.object({
  ruleId: uuid,
  patientId: uuid,
  /** Start from this (past or upcoming) appointment; it becomes the first visit. */
  appointmentId: uuid.nullable(),
  /** Without an appointment: the day the follow-up starts counting from. */
  startedOn: localDate.nullable(),
  smsConsent: z.boolean(),
});
export type StartPlanInput = z.infer<typeof startPlanSchema>;

export const planActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pause"), planId: uuid }),
  z.object({ type: z.literal("resume"), planId: uuid }),
  z.object({ type: z.literal("stop"), planId: uuid, reason: z.enum(FOLLOW_UP_STOP_REASONS) }),
  z.object({ type: z.literal("set_due"), planId: uuid, dueOn: localDate }),
  z.object({ type: z.literal("clear_due"), planId: uuid }),
  z.object({ type: z.literal("record_visit"), planId: uuid, visitedOn: localDate }),
  z.object({ type: z.literal("link"), planId: uuid, appointmentId: uuid }),
  z.object({ type: z.literal("unlink"), planId: uuid, appointmentId: uuid }),
  z.object({ type: z.literal("consent"), planId: uuid, granted: z.boolean() }),
]);
export type PlanAction = z.infer<typeof planActionSchema>;

/**
 * The rule as one Turkish sentence, for the editor preview and lists:
 * "Diş Taşı Temizliği sonrasında hastayı her 6 ayda bir takip et, süresiz."
 */
export function describeRule(rule: {
  triggerServiceName: string | null;
  visitServiceName: string;
  intervalValue: number | null;
  intervalUnit: FollowUpIntervalUnit | null;
  totalVisits: number | null;
}): string {
  const start = rule.triggerServiceName
    ? `${rule.triggerServiceName} sonrasında hastayı`
    : "Hastayı";
  const every =
    rule.intervalValue && rule.intervalUnit
      ? `her ${rule.intervalValue} ${INTERVAL_UNIT_LOCATIVE[rule.intervalUnit]} bir`
      : "(aralık belirlenmedi)";
  const length = rule.totalVisits
    ? `toplam ${rule.totalVisits} ziyaret (ilk ziyaret dahil)`
    : "süresiz";
  return `${start} ${every} takip et, ${length}. Takip ziyareti: ${rule.visitServiceName}.`;
}
