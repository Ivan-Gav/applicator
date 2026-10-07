import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExitIcon } from "./ExitIcon";

describe("ExitIcon", () => {
  it("gives every copy its own mask, so a second copy does not render blank", () => {
    const view = renderToStaticMarkup(
      <>
        <ExitIcon />
        <ExitIcon />
      </>,
    );

    const masks = [...view.matchAll(/<mask id="([^"]+)"/g)].map(([, id]) => id);
    const references = [...view.matchAll(/mask="url\(#([^)]+)\)"/g)].map(([, id]) => id);
    expect(new Set(masks).size).toBe(2);
    expect(references).toEqual(masks);
  });
});
