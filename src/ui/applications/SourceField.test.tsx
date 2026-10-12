import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { messages } from "@/ui/messages";
import { SourceField } from "./SourceField";

const t = messages.applications.form.source;
const search = { action: "/api/sources", name: "q" };

// Answers each search with the sources registered for it, and none for any other.
function answering(bySearch: Record<string, string[]>) {
  return http.get(`*${search.action}`, ({ request }) =>
    HttpResponse.json(bySearch[new URL(request.url).searchParams.get(search.name) ?? ""] ?? []),
  );
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderField(initial = "") {
  function Field() {
    const [value, setValue] = useState(initial);
    return (
      <>
        <label htmlFor="source">Source</label>
        <SourceField id="source" value={value} search={search} onChange={setValue} />
      </>
    );
  }
  render(<Field />);
  return { input: screen.getByRole("combobox", { name: "Source" }), user: userEvent.setup() };
}

describe("SourceField", () => {
  it("suggests sources as one types and takes the one picked as it is spelled", async () => {
    server.use(answering({ linkedin: ["LinkedIn"] }));
    const { input, user } = renderField();

    await user.type(input, "linkedin");
    expect(await screen.findByRole("listbox", { name: t.matches })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "LinkedIn" }));

    expect(input).toHaveValue("LinkedIn");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lists the sources of a blank search on a click, to pick one without typing", async () => {
    server.use(answering({ "": ["LinkedIn", "Xing"] }));
    const { input, user } = renderField("Indeed");

    await user.click(input);
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: "Xing" }));

    expect(input).toHaveValue("Xing");
  });

  it("opens the list with ArrowDown and picks with Enter", async () => {
    server.use(answering({ "": ["LinkedIn", "Xing"] }));
    const { input, user } = renderField();

    // Focus without a click, as Tab would give it.
    input.focus();
    await user.keyboard("{ArrowDown}");
    await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(input).toHaveValue("Xing");
  });

  it("lists the sources again once the text is emptied", async () => {
    server.use(answering({ "": ["LinkedIn", "Xing"], x: ["Xing"] }));
    const { input, user } = renderField();

    await user.type(input, "x");
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    await user.clear(input);

    await vi.waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
  });

  it("keeps any text typed when nothing is suggested", async () => {
    server.use(answering({}));
    const { input, user } = renderField("Xing");

    await user.clear(input);
    await user.type(input, "Berlin Tech Meetup");
    await user.tab();

    expect(input).toHaveValue("Berlin Tech Meetup");
  });
});
