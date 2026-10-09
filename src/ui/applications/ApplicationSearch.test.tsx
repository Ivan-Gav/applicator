import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/ui/messages";
import { ApplicationSearch, type ApplicationSearchProps } from "./ApplicationSearch";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

const replace = vi.fn();
const t = messages.applications.search;
const props: ApplicationSearchProps = {
  action: "/list",
  name: "q",
  value: "",
  hiddenFields: [
    ["status", "applied"],
    ["sort", "company"],
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  vi.useRealTimers();
  replace.mockReset();
});

function renderSearch(overrides: Partial<ApplicationSearchProps> = {}) {
  const view = render(<ApplicationSearch {...props} {...overrides} />);
  return {
    view,
    field: screen.getByRole("searchbox", { name: t.label }),
    user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }),
  };
}

describe("ApplicationSearch", () => {
  it("searches once typing pauses, keeping the rest of the list's state", async () => {
    const { field, user } = renderSearch();

    await user.type(field, "acme");
    expect(replace).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=acme&status=applied&sort=company", {
      scroll: false,
    });
  });

  // A browser submits a lone search field on Enter; jsdom does not, so this submits directly.
  it("searches at once when submitted", async () => {
    const { field, user } = renderSearch();

    await user.type(field, "acme");
    fireEvent.submit(screen.getByRole("search"));

    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=acme&status=applied&sort=company", {
      scroll: false,
    });
  });

  it("leaves a blank search out of the URL", async () => {
    const { field, user } = renderSearch({ value: "acme" });

    await user.clear(field);
    await user.type(field, "   ");
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(replace).toHaveBeenLastCalledWith("/list?status=applied&sort=company", {
      scroll: false,
    });
  });

  it("takes on a search the URL got from elsewhere, such as clearing the filters", () => {
    const { view, field } = renderSearch({ value: "acme" });

    view.rerender(<ApplicationSearch {...props} value="" />);

    expect(field).toHaveValue("");
  });

  it("keeps what is being typed while its own earlier search arrives", async () => {
    const { view, field, user } = renderSearch();

    await user.type(field, "acme");
    fireEvent.submit(screen.getByRole("search"));
    await user.type(field, " corp");
    view.rerender(<ApplicationSearch {...props} value="acme" />);

    expect(field).toHaveValue("acme corp");
  });
});
