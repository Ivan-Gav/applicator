import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateApplication, CreateApplicationRejection } from "@/domain/application/schema";
import { messages } from "@/ui/messages";
import { ApplicationForm } from "./ApplicationForm";
import { applicationFormFields } from "./application-form-fields";

const t = messages.applications.form;

function renderForm(
  outcome: () => Promise<CreateApplicationRejection> = () => Promise.resolve({ invalidFields: [] }),
) {
  const createApplication =
    vi.fn<(input: CreateApplication) => Promise<CreateApplicationRejection>>(outcome);
  render(<ApplicationForm createApplication={createApplication} cancelHref="/list" />);
  return { createApplication, user: userEvent.setup() };
}

function textbox(name: string) {
  return screen.getByRole("textbox", { name });
}

function submitButton() {
  return screen.getByRole("button", { name: t.submit });
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(textbox(t.labels.companyName), "Acme");
  await user.type(textbox(t.labels.positionTitle), "Engineer");
}

describe("ApplicationForm", () => {
  it("labels every field", () => {
    renderForm();

    for (const field of applicationFormFields) {
      expect(screen.getByLabelText(t.labels[field])).toBeVisible();
    }
    expect(screen.getByRole("combobox", { name: t.labels.status })).toHaveValue("draft");
    expect(screen.getByRole("link", { name: t.cancel })).toHaveAttribute("href", "/list");
  });

  it("refuses a missing company name without calling the server", async () => {
    const { createApplication, user } = renderForm();

    await user.type(textbox(t.labels.positionTitle), "Engineer");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.companyName);
    expect(textbox(t.labels.companyName)).toHaveAccessibleDescription(t.errors.companyName);
    expect(textbox(t.labels.companyName)).toBeInvalid();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("sends the parsed values: blanks as null, the day as its local midnight", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.labels.status }),
      messages.applications.status.applied,
    );
    await user.type(screen.getByLabelText(t.labels.appliedAt), "2026-09-01");
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.labels.workMode }),
      messages.applications.workMode.remote,
    );
    await user.type(textbox(t.labels.applicationUrl), "https://example.com/apply");
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0]).toMatchObject({
      companyName: "Acme",
      positionTitle: "Engineer",
      status: "applied",
      appliedAt: new Date(2026, 8, 1),
      workMode: "remote",
      applicationUrl: "https://example.com/apply",
      city: null,
      source: null,
      notes: null,
    });
  });

  it("sends no work mode when none is chosen", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0]).toMatchObject({ workMode: null, appliedAt: null });
  });

  it("shows the fields the server rejected", async () => {
    const { user } = renderForm(() => Promise.resolve({ invalidFields: ["applicationUrl"] }));

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.applicationUrl);
    expect(textbox(t.labels.applicationUrl)).toHaveAccessibleDescription(t.errors.applicationUrl);
    expect(submitButton()).toBeEnabled();
  });

  it("says so when the server rejects a field the form does not show", async () => {
    const { user } = renderForm(() => Promise.resolve({ invalidFields: ["salary"] }));

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.rejected);
  });

  it("keeps the input and reports a failed save", async () => {
    const { user } = renderForm(() => Promise.reject(new Error("network down")));

    await fillRequired(user);
    await user.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(t.saveFailed)).toBeVisible();
    expect(textbox(t.labels.companyName)).toHaveValue("Acme");
    expect(submitButton()).toBeEnabled();
  });

  it("disables submitting while the save is pending", async () => {
    const { createApplication, user } = renderForm(() => new Promise(() => {}));

    await fillRequired(user);
    await user.click(submitButton());

    const pending = await screen.findByRole("button", { name: t.saving });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(createApplication).toHaveBeenCalledOnce();
  });
});
