import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { salaryAmounts } from "@/domain/application/model";
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
    // The error shows before the pending save settles; wait for the button.
    expect(await screen.findByRole("button", { name: t.submit })).toBeEnabled();
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
    // The error shows before the pending save settles; wait for the button.
    expect(await screen.findByRole("button", { name: t.submit })).toBeEnabled();
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

describe("ApplicationForm salary", () => {
  const s = t.salary;

  async function openSalary(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText(s.title));
  }

  it("keeps the salary section closed until asked for", async () => {
    const { user } = renderForm();

    expect(textbox(s.amounts.advertised.from)).not.toBeVisible();

    await openSalary(user);

    expect(textbox(s.amounts.advertised.from)).toBeVisible();
  });

  it("gives every input of the form a distinct accessible name", () => {
    renderForm();
    const names = [
      ...applicationFormFields.map((field) => t.labels[field]),
      ...salaryAmounts.flatMap((amount) => [s.amounts[amount].from, s.amounts[amount].to]),
      s.currency,
      s.period,
    ];

    // getByLabelText throws when a name matches more than one control.
    for (const name of names) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("sends a single figure, a range and an open end in the encoding the schema defines", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await openSalary(user);
    await user.type(textbox(s.amounts.advertised.from), "60000");
    await user.type(textbox(s.amounts.advertised.to), "70000");
    await user.type(textbox(s.amounts.asked.from), "72000");
    await user.type(textbox(s.amounts.asked.to), "72000");
    await user.type(textbox(s.amounts.estimated.from), "75000");
    await user.clear(textbox(s.currency));
    await user.type(textbox(s.currency), "chf");
    await user.selectOptions(
      screen.getByRole("combobox", { name: s.period }),
      messages.applications.salary.period.year,
    );
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0].salary).toEqual({
      advertised: { min: 60_000, max: 70_000 },
      estimated: { min: 75_000, max: null },
      asked: { min: 72_000, max: 72_000 },
      currency: "CHF",
      period: "year",
    });
  });

  it("sends every amount as unknown when the section is left alone", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0].salary).toEqual({
      advertised: { min: null, max: null },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: null,
    });
  });

  it.each([
    ["a minimum above the maximum", "80000", "70000"],
    ["a figure with separators", "60,000", ""],
    ["a fractional figure", "60000.5", ""],
  ])("pins %s to that amount alone", async (_, from, to) => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await openSalary(user);
    await user.type(textbox(s.amounts.asked.from), from);
    if (to) {
      await user.type(textbox(s.amounts.asked.to), to);
    }
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(s.errors.amount);
    expect(textbox(s.amounts.asked.from)).toBeInvalid();
    expect(textbox(s.amounts.asked.from)).toHaveAccessibleDescription(
      expect.stringContaining(s.errors.amount),
    );
    expect(textbox(s.amounts.advertised.from)).toBeValid();
    expect(textbox(s.amounts.estimated.from)).toBeValid();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("refuses a currency that is not three letters", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await openSalary(user);
    await user.clear(textbox(s.currency));
    await user.type(textbox(s.currency), "E1");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(s.errors.currency);
    expect(textbox(s.currency)).toBeInvalid();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("opens the closed section to show an amount the server rejected", async () => {
    const { user } = renderForm(() => Promise.resolve({ invalidFields: ["salary.estimated"] }));

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(s.errors.amount);
    expect(textbox(s.amounts.estimated.from)).toBeVisible();
    expect(textbox(s.amounts.estimated.from)).toBeInvalid();
    expect(textbox(s.amounts.advertised.from)).toBeValid();
  });
});
