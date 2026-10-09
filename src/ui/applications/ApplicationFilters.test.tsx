import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { longWaitDays } from "@/domain/application/list";
import { messages } from "@/ui/messages";
import { ApplicationFilters, type ApplicationFiltersProps } from "./ApplicationFilters";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

const push = vi.fn();
const t = messages.applications;

beforeEach(() => {
  push.mockReset();
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
});

function renderFilters(overrides: Partial<ApplicationFiltersProps> = {}) {
  render(
    <ApplicationFilters
      statuses={[
        { status: "applied", count: 3, on: true, href: "/list?applied-off" },
        { status: "rejected", count: 12, on: false, href: "/list?rejected-on" },
      ]}
      waitingLong={null}
      clearHref={null}
      {...overrides}
    />,
  );
  return {
    group: screen.getByRole("group", { name: t.filters.label }),
    user: userEvent.setup(),
  };
}

describe("ApplicationFilters", () => {
  it("offers each status as a toggle with its count, pressed while it filters", () => {
    const { group } = renderFilters();

    expect(within(group).getByRole("button", { name: `${t.status.applied} 3` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: `${t.status.rejected} 12` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches a filter by going to the list with it switched", async () => {
    const { group, user } = renderFilters();

    await user.click(within(group).getByRole("button", { name: `${t.status.rejected} 12` }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/list?rejected-on", { scroll: false });
  });

  it("offers the long-wait filter with its count only when given one", () => {
    renderFilters({ waitingLong: { on: false, href: "/list?waiting=long", count: 6 } });

    expect(
      screen.getByRole("button", { name: `${t.filters.waitingLong(longWaitDays)} 6` }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("leaves the long-wait filter out when none waits long", () => {
    renderFilters();

    expect(screen.queryByText(t.filters.waitingLong(longWaitDays))).not.toBeInTheDocument();
  });

  it("offers to clear the filters only while some are on", () => {
    renderFilters({ clearHref: "/list" });

    expect(screen.getByRole("link", { name: t.filters.clear })).toHaveAttribute("href", "/list");
  });
});
