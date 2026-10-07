"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { messages } from "@/ui/messages";

export type MainNavItem = {
  href: string;
  label: string;
};

export type MainNavProps = {
  items: readonly MainNavItem[];
};

/** An item is current on its own page and on every page below it. */
export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={messages.nav.label}>
      <ul className="flex items-center gap-5">
        {items.map(({ href, label }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className="inline-block border-b-3 border-transparent px-1 pt-1 pb-1.5 text-[15px] font-semibold hover:border-border aria-[current=page]:border-primary"
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
