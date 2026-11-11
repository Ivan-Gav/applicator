import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

export const bigNumberClass = "font-display text-[40px] leading-none font-semibold";
export const hugeNumberClass = "font-display text-[64px] leading-[0.9] font-semibold";
export const hintClass = "text-[13px] text-muted-foreground";

export type DashboardCardProps = {
  title: string;
  /** Beside the title, at the right. */
  aside?: ReactNode;
  /** The roomier padding of the first row's cards. */
  roomy?: boolean;
  className?: string;
  children: ReactNode;
};

/** A titled card of the dashboard; cards in a row stretch to one height. */
export function DashboardCard({
  title,
  aside,
  roomy = false,
  className,
  children,
}: DashboardCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border bg-card",
        roomy ? "px-6 pt-5.5 pb-6" : "px-5 pt-4.5 pb-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={titleId} className="font-display text-[19px] font-medium">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A big number with its word under it. */
export function Figure({
  value,
  word,
  muted = false,
}: {
  value: number;
  word: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn(bigNumberClass, muted && "text-muted-foreground")}>{value}</span>
      <span className={hintClass}>{word}</span>
    </div>
  );
}
