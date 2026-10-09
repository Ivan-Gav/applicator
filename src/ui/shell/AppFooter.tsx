import { IconTooltip } from "@/ui/IconTooltip";
import { GithubIcon } from "@/ui/icons/GithubIcon";
import { messages } from "@/ui/messages";

export type AppFooterProps = {
  sourceHref: string;
};

const t = messages.footer;

export function AppFooter({ sourceHref }: AppFooterProps) {
  return (
    <footer className="bg-footer text-xs text-footer-foreground">
      <div className="flex justify-end px-6 pt-3.5 pb-1">
        <IconTooltip label={t.sourceCode}>
          <a
            href={sourceHref}
            aria-label={t.sourceCode}
            className="rounded-sm hover:text-foreground"
          >
            <GithubIcon className="size-6" />
          </a>
        </IconTooltip>
      </div>
      <p className="px-6 pt-0.5 pb-3 text-center">{t.copyright}</p>
      <div className="h-0.75 bg-[linear-gradient(90deg,var(--chart-1),var(--chart-2)_35%,var(--chart-4)_70%,var(--chart-5))]" />
    </footer>
  );
}
