import { Badge } from "@/components/ui/badge";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "@/lib/contracts/call";

/** Outcomes that need the team's attention stand out; the rest stay quiet. */
export function OutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <Badge variant="outline">Sürüyor</Badge>;
  const variant =
    outcome === "booked" || outcome === "rescheduled"
      ? "soft"
      : outcome === "callback" || outcome === "transferred"
        ? "default"
        : outcome === "abandoned"
          ? "dashed"
          : "secondary";
  return <Badge variant={variant}>{CALL_OUTCOME_LABELS[outcome]}</Badge>;
}
