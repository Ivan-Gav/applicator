import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import { Logo } from "./Logo";

export const BrandSize = {
  // In the header; below sm only the logo shows, and the name stays for screen readers.
  Header: "header",
  // On the home page, half as large again.
  Hero: "hero",
} as const;
export type BrandSize = (typeof BrandSize)[keyof typeof BrandSize];

/** The alligator and the wordmark, in the logo colour. The caller supplies the element around them. */
export function Brand({ size }: { size: BrandSize }) {
  const hero = size === BrandSize.Hero;

  return (
    <span className={cn("flex items-center text-primary", hero ? "gap-2" : "gap-1.25")}>
      <Logo className={hero ? "size-11.25" : "size-7.5"} />
      <span
        className={cn(
          "font-wordmark font-bold italic",
          hero ? "text-[32px]" : "sr-only text-[21px] sm:not-sr-only",
        )}
      >
        {messages.app.name}
      </span>
    </span>
  );
}
