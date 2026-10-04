import { Bot, Monitor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  APPOINTMENT_SOURCE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentSource,
  type AppointmentStatus,
} from "@/lib/contracts/appointment";
import { cn } from "@/lib/cn";

/** DESIGN-SYSTEM.md §3 "Durum rozetleri": colour never carries meaning alone. */
const STATUS_VARIANT = {
  scheduled: "outline",
  confirmed: "soft",
  completed: "secondary",
  cancelled: "secondary",
  no_show: "dashed",
} as const satisfies Record<AppointmentStatus, string>;

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className={cn(status === "cancelled" && "line-through", className)}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AppointmentSourceBadge({
  source,
  className,
}: {
  source: AppointmentSource;
  className?: string;
}) {
  const Icon = source === "voice" ? Bot : Monitor;
  return (
    <Badge variant={source === "voice" ? "soft" : "outline"} className={className}>
      <Icon aria-hidden />
      {APPOINTMENT_SOURCE_LABELS[source]}
    </Badge>
  );
}
