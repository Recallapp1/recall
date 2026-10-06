import { Badge } from "@/components/ui/badge";
import { FOLLOW_UP_VIEW_LABELS, type FollowUpView } from "@/lib/contracts/follow-up";

const VARIANTS: Record<
  FollowUpView,
  "destructive" | "default" | "soft" | "success" | "secondary" | "outline"
> = {
  overdue: "destructive",
  due: "default",
  upcoming: "soft",
  booked: "success",
  paused: "secondary",
  completed: "outline",
  stopped: "secondary",
};

export function FollowUpViewBadge({ view }: { view: FollowUpView }) {
  return <Badge variant={VARIANTS[view]}>{FOLLOW_UP_VIEW_LABELS[view]}</Badge>;
}
