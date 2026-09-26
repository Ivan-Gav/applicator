import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { messages } from "@/ui/messages";
import { ErrorScreen } from "./ErrorScreen";

const t = messages.error;

describe("ErrorScreen", () => {
  it("reassures the user they are still signed in during an auth outage", () => {
    render(<ErrorScreen authUnavailable retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: t.authUnavailableTitle })).toBeVisible();
    expect(screen.getByText(t.authUnavailableDescription)).toBeVisible();
  });

  it("falls back to a generic message for any other failure", () => {
    render(<ErrorScreen authUnavailable={false} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
    expect(screen.queryByText(t.authUnavailableDescription)).not.toBeInTheDocument();
  });

  it("retries on request", async () => {
    const retry = vi.fn();
    render(<ErrorScreen authUnavailable retry={retry} />);

    await userEvent.setup().click(screen.getByRole("button", { name: t.retry }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
