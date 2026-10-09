import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Application,
  contactParts,
  type SalaryPeriod,
  salaryAmounts,
} from "@/domain/application/model";
import type { ApplicationRejection, CreateApplication } from "@/domain/application/schema";
import { anApplication } from "@/test/application.fixture";
import { Toaster } from "@/ui/kit/sonner";
import { messages } from "@/ui/messages";
import { ApplicationForm } from "./ApplicationForm";
import { applicationFormFields, createOnlyFormFields } from "./application-form-fields";

const t = messages.applications.form;

// Sonner keeps its toasts in module state, which outlives each test's render.
afterEach(() => {
  toast.dismiss();
});

function renderForm(
  outcome: () => Promise<ApplicationRejection> = () => Promise.resolve({ invalidFields: [] }),
  application?: Application,
) {
  const createApplication =
    vi.fn<(input: CreateApplication) => Promise<ApplicationRejection>>(outcome);
  render(
    <>
      <ApplicationForm save={createApplication} backHref="/list" application={application} />
      <Toaster />
    </>,
  );
  return { createApplication, user: userEvent.setup() };
}

function textbox(name: string) {
  return screen.getByRole("textbox", { name });
}

function submitButton() {
  return screen.getByRole("button", { name: t.submit });
}

function saveChangesButton() {
  return screen.getByRole("button", { name: t.saveChanges });
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
    expect(screen.getByRole("link", { name: messages.applications.back })).toHaveAttribute(
      "href",
      "/list",
    );
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

  it("shows no error before the first submit", async () => {
    const { user } = renderForm();

    await user.type(textbox(t.labels.sourceUrl), "not a url");
    await user.tab();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(textbox(t.labels.sourceUrl)).not.toHaveAttribute("aria-invalid");
  });

  it("revalidates every change once a submit has failed", async () => {
    const { user } = renderForm();

    await user.click(submitButton());
    expect(await screen.findByText(t.errors.companyName)).toBeVisible();

    await user.type(textbox(t.labels.companyName), "A");
    expect(screen.queryByText(t.errors.companyName)).not.toBeInTheDocument();
    expect(textbox(t.labels.companyName)).toBeValid();

    await user.clear(textbox(t.labels.companyName));
    expect(screen.getByText(t.errors.companyName)).toBeVisible();

    await user.type(textbox(t.labels.sourceUrl), "not a url");
    expect(screen.getByText(t.errors.sourceUrl)).toBeVisible();
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
    const { promise, resolve } = Promise.withResolvers<ApplicationRejection>();
    const { createApplication, user } = renderForm(() => promise);

    await fillRequired(user);
    await user.click(submitButton());

    const pending = await screen.findByRole("button", { name: t.saving });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(createApplication).toHaveBeenCalledOnce();

    // React entangles async transitions: one left pending would hold every later test's.
    resolve({ invalidFields: [] });
    expect(await screen.findByRole("button", { name: t.submit })).toBeEnabled();
  });
});

describe("ApplicationForm before hydration", () => {
  it("renders saving disabled, as a submit then would reach the browser's default", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ApplicationForm save={vi.fn()} backHref="/list" />);

    expect(within(container).getByRole("button", { name: t.submit })).toBeDisabled();
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
      ...contactParts.map((part) => t.contact.labels[part]),
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
      messages.applications.salary.period.month,
    );
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0].salary).toEqual({
      advertised: { min: 60_000, max: 70_000 },
      estimated: { min: 75_000, max: null },
      asked: { min: 72_000, max: 72_000 },
      currency: "CHF",
      period: "month",
    });
  });

  it("sends every amount as unknown and the period as per year when the section is left alone", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0].salary).toEqual({
      advertised: { min: null, max: null },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: "year",
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

  it("clears a range error once either end puts the range right", async () => {
    const { user } = renderForm();

    await fillRequired(user);
    await openSalary(user);
    await user.type(textbox(s.amounts.asked.from), "80000");
    await user.type(textbox(s.amounts.asked.to), "70000");
    await user.click(submitButton());
    expect(await screen.findByText(s.errors.amount)).toBeVisible();

    await user.type(textbox(s.amounts.asked.to), "0");

    expect(screen.queryByText(s.errors.amount)).not.toBeInTheDocument();
    expect(textbox(s.amounts.asked.from)).toBeValid();
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

describe("ApplicationForm contact", () => {
  const c = t.contact;

  it("keeps the contact section closed until asked for, and sends blanks as unknown", async () => {
    const { createApplication, user } = renderForm();

    expect(textbox(c.labels.name)).not.toBeVisible();
    await fillRequired(user);
    await user.click(screen.getByText(c.title));
    await user.type(textbox(c.labels.name), "Jane Doe");
    await user.type(textbox(c.labels.email), "jane@example.com");
    await user.click(submitButton());

    await vi.waitFor(() => expect(createApplication).toHaveBeenCalledOnce());
    expect(createApplication.mock.calls[0]?.[0].contact).toEqual({
      name: "Jane Doe",
      role: null,
      email: "jane@example.com",
      phone: null,
      url: null,
    });
  });

  it("opens the closed section to show a malformed email", async () => {
    const { createApplication, user } = renderForm();

    await fillRequired(user);
    await user.click(screen.getByText(c.title));
    await user.type(textbox(c.labels.email), "jane at example");
    await user.click(screen.getByText(c.title));
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(c.errors.email);
    expect(textbox(c.labels.email)).toBeVisible();
    expect(textbox(c.labels.email)).toBeInvalid();
    expect(createApplication).not.toHaveBeenCalled();
  });
});

describe("ApplicationForm editing an application", () => {
  const stored = anApplication({
    companyName: "Globex",
    positionTitle: "Platform Engineer",
    seniority: "senior",
    status: "interview",
    city: "Berlin",
    channel: "agency",
    source: "LinkedIn",
    notes: "Second round booked",
    salary: {
      advertised: { min: 60_000, max: 70_000 },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: "year",
    },
    contact: { name: "Jane Doe", role: null, email: null, phone: null, url: null },
  });

  function renderEdit(outcome?: () => Promise<ApplicationRejection>) {
    return renderForm(outcome, stored);
  }

  it("shows every stored value, with the sections that hold some open", () => {
    renderEdit();

    expect(textbox(t.labels.companyName)).toHaveValue("Globex");
    expect(textbox(t.labels.positionTitle)).toHaveValue("Platform Engineer");
    expect(screen.getByRole("combobox", { name: t.labels.seniority })).toHaveValue("senior");
    expect(textbox(t.labels.city)).toHaveValue("Berlin");
    expect(screen.getByRole("combobox", { name: t.labels.channel })).toHaveValue("agency");
    expect(textbox(t.labels.notes)).toHaveValue("Second round booked");
    expect(textbox(t.salary.amounts.advertised.from)).toBeVisible();
    expect(textbox(t.salary.amounts.advertised.from)).toHaveValue("60000");
    expect(textbox(t.contact.labels.name)).toBeVisible();
    expect(textbox(t.contact.labels.name)).toHaveValue("Jane Doe");
  });

  it("sums up the contact by name and role, as they are typed", async () => {
    const { user } = renderEdit();

    expect(screen.getByText(t.contact.summary(["Jane Doe"]))).toBeVisible();

    await user.type(textbox(t.contact.labels.role), "Recruiter");

    expect(screen.getByText(t.contact.summary(["Jane Doe", "Recruiter"]))).toBeVisible();
  });

  it("sums up the advertised salary, as it is typed", async () => {
    const { user } = renderEdit();

    expect(screen.getByText("60,000–70,000 EUR per year")).toBeVisible();

    await user.clear(textbox(t.salary.amounts.advertised.to));

    expect(screen.getByText("from 60,000 EUR per year")).toBeVisible();
  });

  function renderWithPeriodAlone(period: SalaryPeriod) {
    const noAmount = { min: null, max: null };
    renderForm(
      undefined,
      anApplication({
        salary: {
          advertised: noAmount,
          estimated: noAmount,
          asked: noAmount,
          currency: "EUR",
          period,
        },
      }),
    );
  }

  it("keeps the salary section closed when it holds only the default period", () => {
    renderWithPeriodAlone("year");

    expect(textbox(t.salary.amounts.advertised.from)).not.toBeVisible();
  });

  it("opens the salary section for any other period, even without an amount", () => {
    renderWithPeriodAlone("month");

    expect(textbox(t.salary.amounts.advertised.from)).toBeVisible();
  });

  it("offers no status or applied date, which change only through transitions", () => {
    renderEdit();

    for (const field of createOnlyFormFields) {
      expect(screen.queryByLabelText(t.labels[field])).not.toBeInTheDocument();
    }
  });

  it("sends the whole record and says when it is saved", async () => {
    const { createApplication: save, user } = renderEdit();

    await user.clear(textbox(t.labels.city));
    await user.type(textbox(t.labels.city), "Hamburg");
    await user.click(saveChangesButton());

    expect(await screen.findByText(t.saved)).toBeVisible();
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      companyName: "Globex",
      city: "Hamburg",
      channel: "agency",
      salary: { advertised: { min: 60_000, max: 70_000 }, period: "year" },
      contact: { name: "Jane Doe", email: null },
    });
  });

  it("does not claim a save the server rejected", async () => {
    const { user } = renderEdit(() => Promise.resolve({ invalidFields: ["sourceUrl"] }));

    await user.type(textbox(t.labels.sourceUrl), "https://example.com");
    await user.click(saveChangesButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.sourceUrl);
    expect(screen.queryByText(t.saved)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: t.saveChanges })).toBeEnabled();
  });

  it("offers saving only once something differs from the stored record", async () => {
    const { user } = renderEdit();

    expect(saveChangesButton()).toBeDisabled();

    await user.type(textbox(t.labels.city), "x");
    expect(saveChangesButton()).toBeEnabled();

    await user.type(textbox(t.labels.city), "{Backspace}");
    expect(saveChangesButton()).toBeDisabled();
  });

  it("counts an amount typed back to its stored figure as unchanged", async () => {
    const { user } = renderEdit();
    const from = textbox(t.salary.amounts.advertised.from);

    await user.clear(from);
    expect(saveChangesButton()).toBeEnabled();

    await user.type(from, "60000");
    expect(saveChangesButton()).toBeDisabled();
  });

  it("has nothing left to save once the changes are saved", async () => {
    const { user } = renderEdit();

    await user.type(textbox(t.labels.city), "x");
    await user.click(saveChangesButton());

    expect(await screen.findByText(t.saved)).toBeVisible();
    expect(await screen.findByRole("button", { name: t.saveChanges })).toBeDisabled();
    expect(textbox(t.labels.city)).toHaveValue("Berlinx");
  });
});
