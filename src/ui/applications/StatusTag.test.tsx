import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  type Application,
  type ApplicationStatus,
  applicationStatuses,
  StatusChangeFailure,
} from "@/domain/application/model";
import { likelyNextStatuses, otherNextStatuses } from "@/domain/application/rules";
import type { StatusChange } from "@/domain/application/schema";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { StatusTag } from "./StatusTag";

const t = messages.applications;
const s = t.statusChange;
const name = t.name({ companyName: "Acme", positionTitle: "Engineer" });

function renderTag(application: Application) {
  const changeStatus = vi.fn<
    (id: string, change: StatusChange) => Promise<StatusChangeFailure | null>
  >(() => Promise.resolve(null));
  render(<StatusTag application={application} changeStatus={changeStatus} />);
  return { changeStatus, user: userEvent.setup() };
}

function trigger(status: ApplicationStatus) {
  return screen.getByRole("button", { name: s.trigger(t.status[status], name) });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, status: ApplicationStatus) {
  await user.click(trigger(status));
  return screen.getByRole("menu");
}

describe("StatusTag", () => {
  it.each(applicationStatuses)("shows %s as a menu button led by its label", (status) => {
    renderTag(anApplication({ status }));

    expect(trigger(status)).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger(status)).toHaveTextContent(t.status[status]);
  });

  it.each(applicationStatuses)(
    "offers from %s the likely moves first, then every other status past a separator",
    async (status) => {
      const { user } = renderTag(anApplication({ status }));
      const likely = likelyNextStatuses(status);

      const menu = await openMenu(user, status);

      expect(within(menu).getByRole("group", { name: s.menuTitle })).toBeVisible();
      expect(
        within(menu)
          .getAllByRole("menuitem")
          .map((item) => item.textContent),
      ).toEqual([
        ...likely.map((to) => (to === status ? s.again(t.status[to]) : t.status[to])),
        ...otherNextStatuses(status).map((to) => t.status[to]),
      ]);
      expect(within(menu).queryAllByRole("separator")).toHaveLength(likely.length > 0 ? 1 : 0);
    },
  );

  it("moves a closed application on, as when an offer follows a rejection", async () => {
    const { changeStatus, user } = renderTag(anApplication({ status: "rejected" }));

    const menu = await openMenu(user, "rejected");
    await user.click(within(menu).getByRole("menuitem", { name: t.status.offer }));

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith("00000000-0000-4000-8000-0000000000a1", {
      status: "offer",
    });
  });

  it("calls a repeated interview another round, not a plain interview", async () => {
    const { user } = renderTag(anApplication({ status: "interview" }));

    const menu = await openMenu(user, "interview");

    expect(within(menu).getByRole("menuitem", { name: s.again(t.status.interview) })).toBeVisible();
    expect(
      within(menu).queryByRole("menuitem", { name: t.status.interview }),
    ).not.toBeInTheDocument();
  });

  it("moves at once to the status picked, sending only the status: the server dates it", async () => {
    const { changeStatus, user } = renderTag(anApplication({ status: "applied" }));

    const menu = await openMenu(user, "applied");
    await user.click(within(menu).getByRole("menuitem", { name: t.status.screening }));

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith("00000000-0000-4000-8000-0000000000a1", {
      status: "screening",
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([StatusChangeFailure.Outdated, StatusChangeFailure.Invalid])(
    "explains a %s refusal",
    async (failure) => {
      const { changeStatus, user } = renderTag(anApplication({ status: "applied" }));
      changeStatus.mockResolvedValue(failure);

      const menu = await openMenu(user, "applied");
      await user.click(within(menu).getByRole("menuitem", { name: t.status.rejected }));

      expect(await screen.findByRole("alert")).toHaveTextContent(s.failure[failure]);
    },
  );

  it("says so when the change fails outright", async () => {
    const { changeStatus, user } = renderTag(anApplication({ status: "applied" }));
    changeStatus.mockRejectedValue(new Error("network down"));

    const menu = await openMenu(user, "applied");
    await user.click(within(menu).getByRole("menuitem", { name: t.status.rejected }));

    expect(await screen.findByRole("alert")).toHaveTextContent(s.failed);
  });

  it("stays disabled until hydration, as a click then would be lost", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <StatusTag application={anApplication({ status: "applied" })} changeStatus={vi.fn()} />,
    );

    expect(within(container).getByRole("button")).toBeDisabled();
  });
});
