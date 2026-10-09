import { Badge } from "@/components/ui/badge";
import { CALL_FLAG_LABELS, type CallFlag } from "@/lib/contracts/call";

/** Post-call flags; nothing is shown for calls that were not checked or are clean. */
export function CallFlagBadges({ flags }: { flags: readonly CallFlag[] | null }) {
  if (!flags || flags.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((flag) => (
        <Badge key={flag} variant={flag === "medical_risk" ? "outline" : "destructive"}>
          {CALL_FLAG_LABELS[flag]}
        </Badge>
      ))}
    </span>
  );
}
