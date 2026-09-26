import type { Metadata } from "next";
import { messages } from "@/ui/messages";

export const metadata: Metadata = {
  title: messages.applications.title,
};

// Protected by living inside (protected); the layout there decides on access.
export default function ApplicationsPage() {
  return <h1 className="text-2xl font-semibold tracking-tight">{messages.applications.title}</h1>;
}
