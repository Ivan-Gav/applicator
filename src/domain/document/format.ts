import { DocumentUploadFailure } from "./model";

/** The largest file accepted: 4 MiB. */
export const maxDocumentFileBytes = 4 * 1024 * 1024;

/** The longest file name kept; file systems allow no longer ones. */
export const maxFileNameLength = 255;

/** How many leading bytes checkFileContent() reads. */
export const fileContentCheckBytes = 512;

/** The file formats accepted, by an allowlist. */
export const documentFormats = [
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "png",
  "jpeg",
  "webp",
] as const;
export type DocumentFormat = (typeof documentFormats)[number];

type ByteAt = { offset: number; bytes: readonly number[] };

type FormatDetails = {
  mediaType: string;
  /** Lower case, with the dot. */
  extensions: readonly string[];
  /** Bytes every file of the format holds at the given offsets; empty for plain text. */
  signature: readonly ByteAt[];
  /** Whether browsers show such a file themselves, so it can be opened rather than only saved. */
  opensInBrowser: boolean;
};

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));
// ZIP: the container of DOCX and ODT.
const zip = [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }];

export const formatDetails = {
  pdf: {
    mediaType: "application/pdf",
    extensions: [".pdf"],
    signature: [{ offset: 0, bytes: ascii("%PDF-") }],
    opensInBrowser: true,
  },
  doc: {
    mediaType: "application/msword",
    extensions: [".doc"],
    signature: [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
    opensInBrowser: false,
  },
  docx: {
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    signature: zip,
    opensInBrowser: false,
  },
  odt: {
    mediaType: "application/vnd.oasis.opendocument.text",
    extensions: [".odt"],
    signature: zip,
    opensInBrowser: false,
  },
  rtf: {
    mediaType: "application/rtf",
    extensions: [".rtf"],
    signature: [{ offset: 0, bytes: ascii("{\\rtf") }],
    opensInBrowser: false,
  },
  txt: {
    mediaType: "text/plain",
    extensions: [".txt"],
    signature: [],
    opensInBrowser: true,
  },
  png: {
    mediaType: "image/png",
    extensions: [".png"],
    signature: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    opensInBrowser: true,
  },
  jpeg: {
    mediaType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    signature: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    opensInBrowser: true,
  },
  webp: {
    mediaType: "image/webp",
    extensions: [".webp"],
    signature: [
      { offset: 0, bytes: ascii("RIFF") },
      { offset: 8, bytes: ascii("WEBP") },
    ],
    opensInBrowser: true,
  },
} as const satisfies Record<DocumentFormat, FormatDetails>;

/** Every accepted extension and media type, as a file input's `accept` takes them. */
export const acceptedFormats = documentFormats
  .flatMap((format) => [...formatDetails[format].extensions, formatDetails[format].mediaType])
  .join(",");

/** The format a file name's extension stands for, or null when the allowlist does not hold it. */
export function formatOfName(fileName: string): DocumentFormat | null {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) {
    return null;
  }
  const extension = fileName.slice(dot).toLowerCase();
  return (
    documentFormats.find((format) =>
      (formatDetails[format].extensions as readonly string[]).includes(extension),
    ) ?? null
  );
}

/** The format stored under a media type, or null for one the allowlist does not hold. */
export function formatOfMediaType(mediaType: string): DocumentFormat | null {
  return documentFormats.find((format) => formatDetails[format].mediaType === mediaType) ?? null;
}

export type FileCheck =
  | { ok: true; format: DocumentFormat }
  | { ok: false; failure: DocumentUploadFailure };

/**
 * What can be told from a file's name and size alone. The browser checks this
 * before uploading; the server checks it again with checkFileContent().
 */
export function checkFileNameAndSize(fileName: string, sizeBytes: number): FileCheck {
  if (fileName.length === 0 || fileName.length > maxFileNameLength) {
    return { ok: false, failure: DocumentUploadFailure.Invalid };
  }
  if (sizeBytes === 0) {
    return { ok: false, failure: DocumentUploadFailure.Empty };
  }
  if (sizeBytes > maxDocumentFileBytes) {
    return { ok: false, failure: DocumentUploadFailure.TooLarge };
  }
  const format = formatOfName(fileName);
  return format === null
    ? { ok: false, failure: DocumentUploadFailure.UnsupportedType }
    : { ok: true, format };
}

/**
 * checkFileNameAndSize(), and whether the file starts the way files of its
 * format do. `leadingBytes` are its first fileContentCheckBytes bytes, or all
 * of a shorter file. Plain text has no signature; it must not hold a NUL byte.
 */
export function checkFileContent(
  fileName: string,
  sizeBytes: number,
  leadingBytes: Uint8Array,
): FileCheck {
  const check = checkFileNameAndSize(fileName, sizeBytes);
  if (!check.ok) {
    return check;
  }
  const { signature } = formatDetails[check.format];
  const matches =
    signature.length === 0
      ? !leadingBytes.includes(0)
      : signature.every(({ offset, bytes }) =>
          bytes.every((byte, index) => leadingBytes[offset + index] === byte),
        );
  return matches ? check : { ok: false, failure: DocumentUploadFailure.ContentMismatch };
}
