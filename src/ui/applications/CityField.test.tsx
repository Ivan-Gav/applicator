import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CityMatch } from "@/domain/city/model";
import { messages } from "@/ui/messages";
import { CityField } from "./CityField";

const t = messages.applications.form.city;
const search = { action: "/api/cities", name: "q" };

function aMatch(overrides: Partial<CityMatch> & Pick<CityMatch, "id" | "name">): CityMatch {
  return {
    country: "Germany",
    region: null,
    district: null,
    matchedName: null,
    ...overrides,
  };
}

const munich = aMatch({ id: 1, name: "Munich", region: "Bavaria", matchedName: "München" });
const muenster = aMatch({ id: 2, name: "Münster", region: "North Rhine-Westphalia" });

// Answers each search with the cities registered for it, and none for any other.
function answering(bySearch: Record<string, CityMatch[]>) {
  return http.get(`*${search.action}`, ({ request }) =>
    HttpResponse.json(bySearch[new URL(request.url).searchParams.get(search.name) ?? ""] ?? []),
  );
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderField(initial = "") {
  const onPick = vi.fn<(city: string, country: string) => void>();
  function Field() {
    const [value, setValue] = useState(initial);
    return (
      <>
        <label htmlFor="city">City</label>
        <CityField
          id="city"
          value={value}
          search={search}
          onChange={setValue}
          onPick={(city, country) => {
            setValue(city);
            onPick(city, country);
          }}
        />
      </>
    );
  }
  render(<Field />);
  return { onPick, input: screen.getByRole("combobox", { name: "City" }), user: userEvent.setup() };
}

describe("CityField", () => {
  it("suggests the cities found, with where they are, and takes the one picked with its country", async () => {
    server.use(answering({ münchen: [munich] }));
    const { onPick, input, user } = renderField();

    await user.type(input, "münchen");
    await user.click(
      await screen.findByRole("option", {
        name: `${t.option("Munich", "München")}, ${t.place(["Bavaria", "Germany"])}`,
      }),
    );

    expect(onPick).toHaveBeenCalledExactlyOnceWith("Munich", "Germany");
    expect(input).toHaveValue("Munich");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("picks with the arrow keys and Enter", async () => {
    server.use(answering({ mu: [munich, muenster] }));
    const { onPick, input, user } = renderField();

    await user.type(input, "mu");
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledExactlyOnceWith("Münster", "Germany");
  });

  it("keeps any text typed, whether or not a suggestion is picked", async () => {
    server.use(answering({}));
    const { onPick, input, user } = renderField("Berlin");

    await user.clear(input);
    await user.type(input, "Waldbronn");
    await user.tab();

    expect(input).toHaveValue("Waldbronn");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("closes the suggestions on Escape and keeps the text", async () => {
    server.use(answering({ mu: [munich] }));
    const { input, user } = renderField();

    await user.type(input, "mu");
    await screen.findByRole("option");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("mu");
  });

  it("keeps the text when the search fails", async () => {
    server.use(http.get(`*${search.action}`, () => HttpResponse.error()));
    const { input, user } = renderField();

    await user.type(input, "Munich");
    await user.tab();

    expect(input).toHaveValue("Munich");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
