import { Bot } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  APPOINTMENT_SOURCE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentSource,
  type AppointmentStatus,
} from "@/lib/contracts/appointment";
import { cn } from "@/lib/cn";

import {
  formatMinute,
  hourMarks,
  layoutColumn,
  type ScheduleEventInput,
  type VisibleRange,
} from "./layout";

export interface ScheduleColumn {
  id: string;
  label: string;
  description?: string;
}

export interface ScheduleAppointment extends ScheduleEventInput {
  /** Patient name; shown to authenticated clinic staff only. */
  title: string;
  /** Service name, e.g. "Diş taşı temizliği". */
  detail?: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  href?: string;
}

const DEFAULT_RANGE: VisibleRange = { startMinute: 8 * 60, endMinute: 20 * 60 };

/** Block styles per status (DESIGN-SYSTEM.md §3 "Takvim ızgarası"). */
const BLOCK_STYLE: Record<AppointmentStatus, string> = {
  scheduled: "border-primary/30 bg-primary-soft text-heading",
  confirmed: "border-primary bg-primary-soft text-heading",
  completed: "border-hairline bg-canvas text-body",
  cancelled: "border-hairline bg-canvas text-body line-through",
  no_show: "border-dashed border-body/50 bg-paper text-body",
};

/**
 * Day/week schedule: one column per practitioner (day view) or per day (week
 * view). Times are minutes since midnight in the clinic's time zone; the caller
 * converts from UTC. Works as a server component.
 */
export function ScheduleGrid({
  columns,
  appointments,
  range = DEFAULT_RANGE,
  nowMinute,
  hourHeight = 64,
  label,
  className,
}: {
  columns: readonly ScheduleColumn[];
  appointments: readonly ScheduleAppointment[];
  range?: VisibleRange;
  /** Current time in the clinic's zone when the grid shows today. */
  nowMinute?: number;
  hourHeight?: number;
  label: string;
  className?: string;
}) {
  const hours = (range.endMinute - range.startMinute) / 60;
  const bodyHeight = hours * hourHeight;
  const grid: CSSProperties = {
    gridTemplateColumns: `4rem repeat(${columns.length}, minmax(10rem, 1fr))`,
  };
  const showNow =
    nowMinute !== undefined && nowMinute >= range.startMinute && nowMinute < range.endMinute;
  const fraction = (minute: number) =>
    (minute - range.startMinute) / (range.endMinute - range.startMinute);

  return (
    <section
      aria-label={label}
      className={cn("overflow-x-auto rounded-card border border-hairline bg-paper", className)}
    >
      <div className="min-w-fit">
        <div style={grid} className="sticky top-0 z-20 grid border-b border-hairline bg-paper">
          <div aria-hidden />
          {columns.map((column) => (
            <div key={column.id} className="border-l border-hairline px-3 py-3">
              <p className="truncate text-sm font-semibold text-heading">{column.label}</p>
              {column.description && (
                <p className="truncate text-xs text-body">{column.description}</p>
              )}
            </div>
          ))}
        </div>

        <div style={{ ...grid, height: bodyHeight }} className="relative grid">
          <div aria-hidden className="relative">
            {hourMarks(range).map((minute) => (
              <span
                key={minute}
                style={{ top: `${fraction(minute) * 100}%` }}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-body tabular-nums first:translate-y-1"
              >
                {formatMinute(minute)}
              </span>
            ))}
          </div>

          {columns.map((column) => {
            const placed = layoutColumn(
              appointments.filter((appointment) => appointment.columnId === column.id),
              range,
            );
            return (
              <div key={column.id} className="relative border-l border-hairline">
                {hourMarks(range).map((minute) => (
                  <div
                    key={minute}
                    aria-hidden
                    style={{ top: `${fraction(minute) * 100}%` }}
                    className="absolute inset-x-0 border-t border-hairline"
                  />
                ))}
                <ol aria-label={column.label} className="absolute inset-0">
                  {placed.map(({ event, top, height, lane, lanes }) => (
                    <li
                      key={event.id}
                      style={{
                        top: `${top * 100}%`,
                        height: `${height * 100}%`,
                        left: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                      className="absolute p-0.5"
                    >
                      <AppointmentBlock appointment={event} compact={height * bodyHeight < 40} />
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}

          {showNow && (
            <div
              aria-hidden
              style={{ top: `${fraction(nowMinute) * 100}%` }}
              className="pointer-events-none absolute right-0 left-16 z-10 h-0.5 bg-primary before:absolute before:-top-1 before:-left-1 before:size-2.5 before:rounded-full before:bg-primary"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function AppointmentBlock({
  appointment,
  compact,
}: {
  appointment: ScheduleAppointment;
  compact: boolean;
}) {
  const time = `${formatMinute(appointment.startMinute)}–${formatMinute(appointment.endMinute)}`;
  const description = [
    time,
    appointment.title,
    appointment.detail,
    APPOINTMENT_STATUS_LABELS[appointment.status],
    `Kaynak: ${APPOINTMENT_SOURCE_LABELS[appointment.source]}`,
  ]
    .filter(Boolean)
    .join(", ");

  const className = cn(
    "flex h-full w-full flex-col overflow-hidden rounded-[0.75rem] border border-l-4 text-left text-xs transition-colors",
    compact ? "justify-center px-2" : "gap-0.5 px-2 py-1.5",
    BLOCK_STYLE[appointment.status],
    appointment.href && "hover:border-primary",
  );
  const content = (
    <>
      <span className="flex items-center gap-1 font-semibold">
        <span className="truncate">{appointment.title}</span>
        {appointment.source === "voice" && (
          <Bot aria-hidden className="size-3 shrink-0 text-primary" />
        )}
      </span>
      {!compact && (
        <span className="truncate text-body tabular-nums">
          {time}
          {appointment.detail && ` · ${appointment.detail}`}
        </span>
      )}
    </>
  );

  return appointment.href ? (
    <Link href={appointment.href} aria-label={description} className={className}>
      {content}
    </Link>
  ) : (
    <div role="group" aria-label={description} className={className}>
      {content}
    </div>
  );
}
