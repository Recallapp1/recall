"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SettingsResult, WeeklyHours } from "@/lib/contracts/settings";

export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-card border border-hairline bg-paper">
      <div className="flex flex-col gap-1 border-b border-hairline px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-heading">{title}</h2>
        {description && <p className="text-sm text-body">{description}</p>}
      </div>
      <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-card border-t border-hairline bg-canvas px-6 py-4">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Runs a settings action and reports the result as a toast. */
export function useSave() {
  const [pending, startTransition] = useTransition();
  const save = (run: () => Promise<SettingsResult>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        toast.success(result.message);
        onSuccess?.();
      } else {
        toast.error(result.message);
      }
    });
  return { pending, save };
}

export function SaveButton({
  pending,
  onClick,
  disabled,
  children = "Kaydet",
}: {
  pending: boolean;
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Button onClick={onClick} disabled={pending || disabled}>
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}

export const WEEKDAYS = [
  [1, "Pazartesi"],
  [2, "Salı"],
  [3, "Çarşamba"],
  [4, "Perşembe"],
  [5, "Cuma"],
  [6, "Cumartesi"],
  [7, "Pazar"],
] as const;

/** Weekly opening hours: any number of ranges per day (e.g. a lunch break). */
export function WeeklyHoursEditor({
  value,
  onChange,
  readOnly,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  readOnly?: boolean;
}) {
  const update = (index: number, patch: Partial<WeeklyHours[number]>) =>
    onChange(value.map((range, i) => (i === index ? { ...range, ...patch } : range)));

  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {WEEKDAYS.map(([weekday, label]) => {
        const ranges = value
          .map((range, index) => ({ range, index }))
          .filter(({ range }) => range.weekday === weekday);
        return (
          <li key={weekday} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
            <span className="w-28 shrink-0 pt-2 text-sm font-medium text-heading">{label}</span>
            <div className="flex flex-1 flex-col gap-2">
              {ranges.length === 0 && <span className="pt-2 text-sm text-body">Kapalı</span>}
              {ranges.map(({ range, index }) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${label} başlangıç`}
                    value={range.startTime}
                    disabled={readOnly}
                    onChange={(event) => update(index, { startTime: event.target.value })}
                    className="h-10 w-32"
                  />
                  <span aria-hidden className="text-body">
                    –
                  </span>
                  <Input
                    type="time"
                    aria-label={`${label} bitiş`}
                    value={range.endTime}
                    disabled={readOnly}
                    onChange={(event) => update(index, { endTime: event.target.value })}
                    className="h-10 w-32"
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${label} aralığını sil`}
                      onClick={() => onChange(value.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  const last = ranges.at(-1)?.range;
                  onChange([
                    ...value,
                    last
                      ? {
                          weekday,
                          startTime: last.endTime < "23:00" ? last.endTime : "09:00",
                          endTime: "18:00",
                        }
                      : { weekday, startTime: "09:00", endTime: "18:00" },
                  ]);
                }}
              >
                <Plus data-icon="inline-start" />
                Aralık ekle
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
