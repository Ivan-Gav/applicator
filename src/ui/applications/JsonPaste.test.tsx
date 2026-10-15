import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/ui/kit/sonner";
import { messages } from "@/ui/messages";
import { JsonPaste } from "./JsonPaste";

const t = messages.applications.form.paste;
const example = t.example;

afterEach(() => {
  toast.dismiss();
});

async function renderOpened() {
  render(
    <>
      <JsonPaste onRead={vi.fn()} formatHref="/format" />
      <Toaster />
    </>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByText(t.title));
  return { user };
}

describe("JsonPaste example", () => {
  it("copies the example to the clipboard and says so", async () => {
    const { user } = await renderOpened();

    await user.click(screen.getByRole("button", { name: example.copyLabel }));

    expect(await screen.findByText(example.copied)).toBeVisible();
    expect(JSON.parse(await navigator.clipboard.readText())).toEqual(example.value);
  });

  it("says so when the clipboard refuses", async () => {
    const { user } = await renderOpened();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

    await user.click(screen.getByRole("button", { name: example.copyLabel }));

    expect(await screen.findByText(example.copyFailed)).toBeVisible();
  });

  it("offers the example as a JSON file", async () => {
    await renderOpened();

    const link = screen.getByRole("link", { name: example.downloadLabel });
    expect(link).toHaveAttribute("download", example.fileName);
    const href = link.getAttribute("href") ?? "";
    const [kind, content = ""] = href.split(",");
    expect(kind).toBe("data:application/json;charset=utf-8");
    expect(JSON.parse(decodeURIComponent(content))).toEqual(example.value);
  });

  it("is the first example of the format document", () => {
    // Under jsdom import.meta.url is no file URL; tests run from the project root.
    const document = readFileSync(join(process.cwd(), "docs", "application-json.md"), "utf8");
    const [, first = ""] = /```json\n([\s\S]*?)```/.exec(document) ?? [];

    expect(JSON.parse(first)).toEqual(example.value);
  });
});
