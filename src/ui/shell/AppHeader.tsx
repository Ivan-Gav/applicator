import Link from "next/link";
import { ExitIcon } from "@/ui/icons/ExitIcon";
import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";
import { ThemeSwitch } from "@/ui/theme/ThemeSwitch";
import { Brand, BrandSize } from "./Brand";
import { MainNav, type MainNavItem } from "./MainNav";

export type AppHeaderProps = {
  homeHref: string;
  navItems: readonly MainNavItem[];
  email: string;
  signOut: () => Promise<void>;
};

export function AppHeader({ homeHref, navItems, email, signOut }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-15 border-b bg-header">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href={homeHref} className="flex">
            <Brand size={BrandSize.Header} />
          </Link>
          <MainNav items={navItems} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-muted-foreground sm:inline">{email}</span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label={messages.nav.signOut}
              className="rounded-full hover:bg-accent dark:hover:bg-accent"
            >
              <ExitIcon className="size-5.5" />
            </Button>
          </form>
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
