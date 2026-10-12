import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { messages } from "@/ui/messages";
import { AppFooter } from "./AppFooter";

const placeData = {
  sourceHref: "https://example.com/places",
  licenceHref: "https://example.com/licence",
};

describe("AppFooter", () => {
  it("links to the source code by name, though it shows only an icon", () => {
    render(<AppFooter sourceHref="https://example.com/repo" placeData={placeData} />);

    expect(screen.getByRole("link", { name: messages.footer.sourceCode })).toHaveAttribute(
      "href",
      "https://example.com/repo",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(messages.footer.copyright);
  });

  it("credits the source of the place names under its licence", () => {
    render(<AppFooter sourceHref="https://example.com/repo" placeData={placeData} />);

    expect(screen.getByRole("link", { name: messages.footer.placeDataSource })).toHaveAttribute(
      "href",
      placeData.sourceHref,
    );
    expect(screen.getByRole("link", { name: messages.footer.placeDataLicence })).toHaveAttribute(
      "href",
      placeData.licenceHref,
    );
  });
});
