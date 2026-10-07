import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { messages } from "@/ui/messages";
import { AppFooter } from "./AppFooter";

describe("AppFooter", () => {
  it("links to the source code by name, though it shows only an icon", () => {
    render(<AppFooter sourceHref="https://example.com/repo" />);

    expect(screen.getByRole("link", { name: messages.footer.sourceCode })).toHaveAttribute(
      "href",
      "https://example.com/repo",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(messages.footer.copyright);
  });
});
