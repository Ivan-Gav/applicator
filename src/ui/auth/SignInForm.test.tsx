import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MagicLinkRequestStatus,
  type MagicLinkRequestOutcome,
  SignInFailureReason,
} from "@/domain/user/model";
import { messages } from "@/ui/messages";
import { SignInForm } from "./SignInForm";

const t = messages.signIn;

function renderForm(
  outcome: MagicLinkRequestOutcome = { status: MagicLinkRequestStatus.Sent },
  failureMessage: string | null = null,
) {
  const requestMagicLink = vi.fn<(input: { email: string }) => Promise<MagicLinkRequestOutcome>>(
    () => Promise.resolve(outcome),
  );
  render(<SignInForm requestMagicLink={requestMagicLink} failureMessage={failureMessage} />);
  return { requestMagicLink, user: userEvent.setup() };
}

function emailField() {
  return screen.getByRole("textbox", { name: t.emailLabel });
}

function submitButton() {
  return screen.getByRole("button", { name: t.submit });
}

describe("SignInForm", () => {
  it("has a labelled email field and a submit button", () => {
    renderForm();

    expect(screen.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
    expect(emailField()).toBeVisible();
    expect(submitButton()).toBeVisible();
  });

  it("shows the callback failure message when given one", () => {
    const message = t.failure[SignInFailureReason.VerifierMissing];
    renderForm({ status: MagicLinkRequestStatus.Sent }, message);

    expect(screen.getByRole("alert", { name: t.failureTitle })).toHaveTextContent(message);
  });

  it("rejects an invalid address without calling the server", async () => {
    const { requestMagicLink, user } = renderForm();

    await user.type(emailField(), "not-an-address");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.invalidEmail);
    expect(emailField()).toHaveAccessibleDescription(t.invalidEmail);
    expect(requestMagicLink).not.toHaveBeenCalled();
  });

  it("switches to the inbox state naming the address after a successful request", async () => {
    const { requestMagicLink, user } = renderForm();

    await user.type(emailField(), "ivan@example.com");
    await user.click(submitButton());

    expect(await screen.findByRole("heading", { level: 1, name: t.inbox.title })).toBeVisible();
    expect(screen.getByText("ivan@example.com")).toBeVisible();
    expect(requestMagicLink).toHaveBeenCalledWith({ email: "ivan@example.com" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sends again to the same address from the inbox state", async () => {
    const { requestMagicLink, user } = renderForm();

    await user.type(emailField(), "ivan@example.com");
    await user.click(submitButton());
    await user.click(await screen.findByRole("button", { name: t.inbox.sendAgain }));

    expect(await screen.findByRole("status")).toHaveTextContent(t.inbox.resent);
    expect(requestMagicLink).toHaveBeenCalledTimes(2);
    expect(requestMagicLink).toHaveBeenLastCalledWith({ email: "ivan@example.com" });
  });

  it("returns to the form with the address prefilled to fix a typo", async () => {
    const { user } = renderForm();

    await user.type(emailField(), "ivan@exmaple.com");
    await user.click(submitButton());
    await user.click(await screen.findByRole("button", { name: t.inbox.useDifferentAddress }));

    expect(await screen.findByRole("textbox", { name: t.emailLabel })).toHaveValue(
      "ivan@exmaple.com",
    );
    expect(screen.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  });

  it("surfaces the wait when the address is rate limited", async () => {
    const { user } = renderForm({
      status: MagicLinkRequestStatus.RateLimited,
      retryAfterSeconds: 30,
    });

    await user.type(emailField(), "ivan@example.com");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.rateLimited(30));
    expect(submitButton()).toBeEnabled();
  });

  it("tells the user when sign-in is unavailable", async () => {
    const { user } = renderForm({ status: MagicLinkRequestStatus.Unavailable });

    await user.type(emailField(), "ivan@example.com");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.failure[SignInFailureReason.Unavailable],
    );
  });
});
