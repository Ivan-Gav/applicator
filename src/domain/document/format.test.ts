import { describe, expect, it } from "vitest";
import {
  acceptedFormats,
  checkFileContent,
  checkFileNameAndSize,
  documentFormats,
  formatDetails,
  formatOfMediaType,
  formatOfName,
  maxDocumentFileBytes,
  maxFileNameLength,
} from "./format";
import { DocumentUploadFailure } from "./model";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string" ? [...value].map((c) => c.charCodeAt(0)) : [value],
    ),
  );

// The first bytes of a real file of each format.
const leadingBytesOf = {
  pdf: bytes("%PDF-1.7\n"),
  doc: bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00),
  docx: bytes("PK", 0x03, 0x04, 0x14, 0x00),
  odt: bytes("PK", 0x03, 0x04, 0x14, 0x00),
  rtf: bytes("{\\rtf1\\ansi"),
  txt: bytes("Jane Doe\nSenior Engineer\n"),
  png: bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0x00),
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0),
  webp: bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WEBPVP8 "),
} as const;

describe("formatOfName", () => {
  it.each([
    ["cv.pdf", "pdf"],
    ["CV.PDF", "pdf"],
    ["letter.docx", "docx"],
    ["scan.jpg", "jpeg"],
    ["scan.jpeg", "jpeg"],
    ["my.cv.v2.odt", "odt"],
  ])("reads %s as %s", (name, format) => {
    expect(formatOfName(name)).toBe(format);
  });

  it.each(["cv", "cv.exe", "page.html", "image.svg", "archive.zip", "cv.pdf.exe"])(
    "refuses %s",
    (name) => {
      expect(formatOfName(name)).toBeNull();
    },
  );
});

describe("formatOfMediaType", () => {
  it("finds every allowed format by its media type", () => {
    for (const format of documentFormats) {
      expect(formatOfMediaType(formatDetails[format].mediaType)).toBe(format);
    }
  });

  it("knows no other media type", () => {
    expect(formatOfMediaType("text/html")).toBeNull();
  });
});

describe("opensInBrowser", () => {
  it("holds for what browsers show themselves, and not for word processor files", () => {
    expect(documentFormats.filter((format) => formatDetails[format].opensInBrowser)).toEqual([
      "pdf",
      "txt",
      "png",
      "jpeg",
      "webp",
    ]);
  });
});

describe("acceptedFormats", () => {
  it("lists each extension and media type for a file input", () => {
    expect(acceptedFormats.split(",")).toEqual(
      expect.arrayContaining([".pdf", "application/pdf", ".jpg", ".jpeg", "image/jpeg"]),
    );
  });
});

describe("checkFileNameAndSize", () => {
  it("accepts an allowed file up to the limit", () => {
    expect(checkFileNameAndSize("cv.pdf", maxDocumentFileBytes)).toEqual({
      ok: true,
      format: "pdf",
    });
  });

  it.each([
    ["an empty file", "cv.pdf", 0, DocumentUploadFailure.Empty],
    [
      "a file a byte over the limit",
      "cv.pdf",
      maxDocumentFileBytes + 1,
      DocumentUploadFailure.TooLarge,
    ],
    ["a format not on the list", "cv.exe", 10, DocumentUploadFailure.UnsupportedType],
    ["a nameless file", "", 10, DocumentUploadFailure.Invalid],
    [
      "a name longer than file systems allow",
      `${"a".repeat(maxFileNameLength)}.pdf`,
      10,
      DocumentUploadFailure.Invalid,
    ],
  ])("refuses %s", (_, name, size, failure) => {
    expect(checkFileNameAndSize(name, size)).toEqual({ ok: false, failure });
  });
});

describe("checkFileContent", () => {
  it.each(documentFormats)("accepts a %s file that starts as its format does", (format) => {
    const name = `file${formatDetails[format].extensions[0]}`;
    expect(checkFileContent(name, 100, leadingBytesOf[format])).toEqual({ ok: true, format });
  });

  it.each([
    ["a script renamed to .pdf", "cv.pdf", bytes("#!/bin/sh\n")],
    ["a PNG named .jpg", "photo.jpg", leadingBytesOf.png],
    ["a RIFF file that is not WebP", "clip.webp", bytes("RIFF", 0, 0, 0, 0, "WAVE")],
    ["a binary file named .txt", "notes.txt", bytes("MZ", 0x90, 0x00)],
    ["a file shorter than its signature", "cv.pdf", bytes("%P")],
  ])("refuses %s", (_, name, leadingBytes) => {
    expect(checkFileContent(name, 100, leadingBytes)).toEqual({
      ok: false,
      failure: DocumentUploadFailure.ContentMismatch,
    });
  });

  it("refuses by name and size before reading the content", () => {
    expect(checkFileContent("cv.exe", 100, leadingBytesOf.pdf)).toEqual({
      ok: false,
      failure: DocumentUploadFailure.UnsupportedType,
    });
  });
});
