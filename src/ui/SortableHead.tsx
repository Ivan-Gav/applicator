import Link from "next/link";
import { SortDirection } from "@/lib/sort-direction";
import { cn } from "@/lib/utils";
import { TableHead } from "@/ui/kit/table";
import { messages } from "@/ui/messages";

/** A column header's link; `direction` is set on the column the list is ordered by. */
export type SortLink = {
  href: string;
  direction: SortDirection | null;
};

const ariaSort = {
  [SortDirection.Ascending]: "ascending",
  [SortDirection.Descending]: "descending",
} as const satisfies Record<SortDirection, string>;

/** A table column header that orders the list by its column. */
export function SortableHead({
  label,
  link,
  className,
}: {
  label: string;
  link: SortLink;
  className?: string;
}) {
  return (
    <TableHead
      scope="col"
      aria-sort={link.direction ? ariaSort[link.direction] : undefined}
      className={className}
    >
      {/* A click on the ordered column reverses it; on another, orders by that one. */}
      <Link
        href={link.href}
        scroll={false}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-xs px-2 text-[13px] font-medium hover:text-foreground hover:no-underline",
          link.direction ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {/* Holds its place on every column, so the label does not shift when the order moves. */}
        <span aria-hidden className="w-2.5 text-[10px]">
          {link.direction && messages.list.sortIndicator[link.direction]}
        </span>
      </Link>
    </TableHead>
  );
}
