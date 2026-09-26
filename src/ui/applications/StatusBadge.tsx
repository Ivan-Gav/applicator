import type { ApplicationStatus } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/kit/badge";
import { messages } from "@/ui/messages";

const statusStyles: Record<ApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  applied: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  screening: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  interview: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  offer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  withdrawn: "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400",
};

export type StatusBadgeProps = {
  status: ApplicationStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = messages.applications.status[status];

  return (
    <Badge
      role="status"
      aria-label={label}
      variant="outline"
      className={cn("border-transparent", statusStyles[status], className)}
    >
      {label}
    </Badge>
  );
}
