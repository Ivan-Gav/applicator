import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Application } from "@/domain/application/model";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { ApplicationActions } from "./ApplicationActions";

const t = messages.applications;
const d = t.deleteDialog;
const name = t.name({ companyName: "Acme", positionTitle: "Engineer" });

function renderActions(application: Application = anApplication()) {
  const actions = {
    archive: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
    unarchive: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
    delete: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  };
  render(<ApplicationActions application={application} actions={actions} />);
  return { actions, user: userEvent.setup() };
}

function button(action: string) {
  return screen.getByRole("button", { name: t.actions.label(action, name) });
}

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
        actions={{ archive: vi.fn(), unarchive: vi.fn(), delete: vi.fn() }}
      />,
    );

    const buttons = within(container).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const action of buttons) {
      expect(action).toBeDisabled();
    }
  });
});
