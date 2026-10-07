import type { Metadata } from "next";
import { routes } from "@/app/routes";
import { ApplicationForm } from "@/ui/applications/ApplicationForm";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { createApplication } from "../actions";

export const metadata: Metadata = {
  title: messages.applications.form.title,
};

// Protected by living inside (protected); createApplication checks on its own.
export default function NewApplicationPage() {
  return (
    <PageColumn width={ColumnWidth.Narrow}>
      <h1 className="text-[30px] leading-tight font-semibold">
        {messages.applications.form.title}
      </h1>
      <ApplicationForm save={createApplication} backHref={routes.applications} />
    </PageColumn>
  );
}
