import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { nextDirection, type Sort, type SortDirection } from "@/lib/contracts/sorting";

/**
 * A table column header that sorts by a link (works without JavaScript, like
 * the filters). `href` builds the page URL for a given sort; aria-sort tells
 * screen readers the current order.
 */
export function SortableHead<Key extends string>({
  label,
  sortKey,
  current,
  href,
  className,
}: {
  label: string;
  sortKey: Key;
  current: Sort<Key> | undefined;
  href: (sort: Sort<Key>) => string;
  className?: string;
}) {
  const active = current?.key === sortKey;
  const direction: SortDirection = nextDirection(current, sortKey);
  const Icon = !active ? ArrowUpDown : current.direction === "artan" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={!active ? "none" : current.direction === "artan" ? "ascending" : "descending"}
    >
      <Link
        href={href({ key: sortKey, direction })}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-heading",
          active && "text-heading",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-40")} />
        <span className="sr-only">
          {direction === "artan" ? ", artan sırala" : ", azalan sırala"}
        </span>
      </Link>
    </TableHead>
  );
}
