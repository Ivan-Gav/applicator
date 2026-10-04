import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type Application,
  type ApplicationStatus,
  StatusChangeFailure,
} from "@/domain/application/model";
import { nextStatuses } from "@/domain/application/rules";
import type { StatusChange } from "@/domain/application/schema";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { ApplicationActions } from "./ApplicationActions";

const t = messages.applications;
const s = t.statusChange;
const d = t.deleteDialog;
const name = t.name({ companyName: "Acme", positionTitle: "Engineer" });
const editHref = "/list/00000000-0000-4000-8000-0000000000a1";

function renderActions(application: Application = anApplication()) {
  const actions = {
    changeStatus: vi.fn<(id: string, change: StatusChange) => Promise<StatusChangeFailure | null>>(
      () => Promise.resolve(null),
    ),
    archive: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
    unarchive: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
    delete: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  };
  render(<ApplicationActions application={application} editHref={editHref} actions={actions} />);
  return { actions, user: userEvent.setup() };
}

function button(action: string) {
  return screen.getByRole("button", { name: t.actions.label(action, name) });
}

describe("change status", () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(button(s.title));
    return screen.getByRole("dialog", { name: s.title });
  }

  it.each(["draft", "applied", "screening", "interview", "offer"] as const)(
    "offers from %s exactly the moves the domain allows",
    async (status: ApplicationStatus) => {
      const { user } = renderActions(anApplication({ status }));

      const dialog = await openDialog(user);

      const offered = within(dialog)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value"));
      expect(offered).toEqual(nextStatuses(status));
    },
  );

  it.each(["rejected", "withdrawn"] as const)("offers no change from %s", (status) => {
    renderActions(anApplication({ status }));

    expect(screen.queryByRole("button", { name: t.actions.label(s.title, name) })).toBeNull();
  });

  it("sends only the chosen status: the server dates the change", async () => {
    const { actions, user } = renderActions(anApplication({ status: "applied" }));

    const dialog = await openDialog(user);
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: s.status }),
      t.status.rejected,
    );
    await user.click(within(dialog).getByRole("button", { name: s.submit }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(actions.changeStatus).toHaveBeenCalledExactlyOnceWith(
      "00000000-0000-4000-8000-0000000000a1",
      { status: "rejected" },
    );
  });

  it("asks for nothing but the status", async () => {
    const { user } = renderActions(anApplication({ status: "applied" }));

    const dialog = await openDialog(user);

    expect(within(dialog).getAllByRole("combobox")).toHaveLength(1);
    expect(within(dialog).queryAllByRole("textbox")).toEqual([]);
    expect(within(dialog).queryByLabelText(/date|day|when/i)).not.toBeInTheDocument();
  });

  it.each([StatusChangeFailure.Illegal, StatusChangeFailure.Outdated, StatusChangeFailure.Invalid])(
    "keeps the dialog open and explains a %s refusal",
    async (failure) => {
      const { actions, user } = renderActions(anApplication({ status: "applied" }));
      actions.changeStatus.mockResolvedValue(failure);

      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole("button", { name: s.submit }));

      expect(await within(dialog).findByText(s.failure[failure])).toBeVisible();
    },
  );
});

describe("archive", () => {
  it("archives an active application", async () => {
    const { actions, user } = renderActions();

    await user.click(button(t.actions.archive));

    expect(actions.archive).toHaveBeenCalledExactlyOnceWith("00000000-0000-4000-8000-0000000000a1");
    expect(actions.delete).not.toHaveBeenCalled();
  });

  it("restores an archived application instead", async () => {
    const { actions, user } = renderActions(
      anApplication({ archivedAt: new Date("2026-09-20T08:00:00.000Z") }),
    );

    await user.click(button(t.actions.unarchive));

    expect(actions.unarchive).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: t.actions.label(t.actions.archive, name) }),
    ).toBeNull();
  });

  it("says so when archiving fails", async () => {
    const { actions, user } = renderActions();
    actions.archive.mockRejectedValue(new Error("network down"));

    await user.click(button(t.actions.archive));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.actions.failed);
  });
});

describe("delete", () => {
  it("looks unlike archiving", () => {
    renderActions();

    expect(button(t.actions.delete).dataset.variant).toBe("destructive");
    expect(button(t.actions.archive).dataset.variant).not.toBe("destructive");
  });

  it("asks first, naming the application, and deletes only once confirmed", async () => {
    const { actions, user } = renderActions();

    await user.click(button(t.actions.delete));

    const dialog = screen.getByRole("alertdialog", { name: d.title });
    expect(dialog).toHaveAccessibleDescription(d.description(name));
    expect(actions.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: d.confirm }));

    expect(actions.delete).toHaveBeenCalledExactlyOnceWith("00000000-0000-4000-8000-0000000000a1");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("deletes nothing when cancelled", async () => {
    const { actions, user } = renderActions();

    await user.click(button(t.actions.delete));
    await user.click(screen.getByRole("button", { name: d.cancel }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.delete).not.toHaveBeenCalled();
  });
});

describe("before hydration", () => {
  it("renders every action disabled, as a click then would be lost", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <ApplicationActions
        application={anApplication()}
        editHref={editHref}
        actions={{ changeStatus: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), delete: vi.fn() }}
      />,
    );

    const buttons = within(container).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const action of buttons) {
      expect(action).toBeDisabled();
    }
  });

  it("links to editing already, as a link needs no script", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <ApplicationActions
        application={anApplication()}
        editHref={editHref}
        actions={{ changeStatus: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), delete: vi.fn() }}
      />,
    );

    expect(
      within(container).getByRole("link", { name: t.actions.label(t.actions.edit, name) }),
    ).toHaveAttribute("href", editHref);
  });
});
