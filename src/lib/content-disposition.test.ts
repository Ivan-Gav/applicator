import { describe, expect, it } from "vitest";
import { contentDisposition } from "./content-disposition";

describe("contentDisposition", () => {
  it("names a plain file as it is, to save or to show", () => {
    expect(contentDisposition("attachment", "cv.pdf")).toBe(
      `attachment; filename="cv.pdf"; filename*=UTF-8''cv.pdf`,
    );
    expect(contentDisposition("inline", "cv.pdf")).toBe(
      `inline; filename="cv.pdf"; filename*=UTF-8''cv.pdf`,
    );
  });

  it("keeps any name in filename* and gives an ASCII stand-in without quotes or backslashes", () => {
    expect(contentDisposition("attachment", 'Résumé "final"\\it\'s*.pdf')).toBe(
      `attachment; filename="R_sum_ _final__it's*.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%22final%22%5Cit%27s%2A.pdf`,
    );
  });
});
