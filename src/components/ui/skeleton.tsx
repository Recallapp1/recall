import { cn } from "@/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-card-sm bg-hairline", className)}
      {...props}
    />
  );
}

export { Skeleton };
