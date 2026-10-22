import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { documentStorageForRequest } from "@/adapters/supabase/document.storage";
import { requireUser } from "@/app/auth/_utils/require-user";
import { documentFileOpenPath, documentFilePath, signInPath } from "@/app/routes";
import type { DocumentFormat } from "@/domain/document/format";
import { FileDeliveryKind, FileDisposition } from "@/domain/document/storage";
import { InMemoryDocumentRepository } from "@/test/in-memory-document.repository";
import { InMemoryDocumentStorage } from "@/test/in-memory-document.storage";
import { GET } from "./route";

vi.mock("@/adapters/supabase/document.repository", () => ({
  documentRepositoryForRequest: vi.fn(),
}));
vi.mock("@/adapters/supabase/document.storage", () => ({ documentStorageForRequest: vi.fn() }));
vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};
const otherUser = "00000000-0000-4000-8000-00000000000b";
const content = "%PDF-1.7\nhello";

let repository: InMemoryDocumentRepository;
let storage: InMemoryDocumentStorage;

beforeEach(() => {
  repository = new InMemoryDocumentRepository();
  storage = new InMemoryDocumentStorage();
  vi.mocked(documentRepositoryForRequest).mockResolvedValue(repository);
  vi.mocked(documentStorageForRequest).mockResolvedValue(storage);
  vi.mocked(requireUser).mockResolvedValue(sessionUser);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function storedVersion(
  owner: string,
  fileName = "Lebenslauf (März).pdf",
  format: DocumentFormat = "pdf",
) {
  const storageKey = await storage.save(owner, new Blob([content]), "application/pdf");
  const document = await repository.create(
    owner,
    { type: "cv", title: "CV", language: null },
    { storageKey, fileName, format, sizeBytes: content.length, label: null },
  );
  return document.versions[0]!;
}

function get(path: string, versionId: string) {
  const request = new NextRequest(new URL(path, "http://localhost:3000"));
  return GET(request, { params: Promise.resolve({ versionId }) });
}

const download = (versionId: string) => get(documentFilePath(versionId), versionId);
const open = (versionId: string) => get(documentFileOpenPath(versionId), versionId);

describe("GET /api/document-files/[versionId]", () => {
  it("sends the browser on to the address the storage gives, never cached", async () => {
    const version = await storedVersion(sessionUser.id);
    const signed = "https://storage.example.test/signed/abc?token=t";
    const deliver = vi
      .spyOn(storage, "deliver")
      .mockResolvedValue({ kind: FileDeliveryKind.Redirect, url: signed });

    const response = await download(version.id);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(signed);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(deliver).toHaveBeenCalledWith(version.storageKey, {
      fileName: version.fileName,
      mediaType: "application/pdf",
      disposition: FileDisposition.Attachment,
    });
  });

  it("saves the bytes under the original name when the storage hands them over", async () => {
    const version = await storedVersion(sessionUser.id);

    const response = await download(version.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="Lebenslauf (M_rz).pdf"; filename*=UTF-8''Lebenslauf%20%28M%C3%A4rz%29.pdf`,
    );
    await expect(response.text()).resolves.toBe(content);
  });

  it("shows a PDF in the browser, still under its name, its type never sniffed", async () => {
    const version = await storedVersion(sessionUser.id, "cv.pdf");
    const deliver = vi.spyOn(storage, "deliver");

    const response = await open(version.id);

    expect(deliver).toHaveBeenCalledWith(
      version.storageKey,
      expect.objectContaining({ disposition: FileDisposition.Inline }),
    );
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="cv.pdf"; filename*=UTF-8''cv.pdf`,
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe(content);
  });

  it("saves a format browsers cannot show, even when asked to show it", async () => {
    const version = await storedVersion(sessionUser.id, "letter.docx", "docx");

    const response = await open(version.id);

    expect(response.headers.get("content-disposition")).toMatch(/^attachment; /);
  });

  it("does not find another user's version", async () => {
    const theirs = await storedVersion(otherUser);
    const deliver = vi.spyOn(storage, "deliver");

    expect((await download(theirs.id)).status).toBe(404);
    expect((await open(theirs.id)).status).toBe(404);
    expect(deliver).not.toHaveBeenCalled();
  });

  it.each(["not-a-uuid", "00000000-0000-4000-8000-0000000000ff"])(
    "does not find %s",
    async (versionId) => {
      expect((await download(versionId)).status).toBe(404);
    },
  );

  it("delivers nothing without a session", async () => {
    const version = await storedVersion(sessionUser.id);
    const redirected = new Error(`redirected to ${signInPath()}`);
    vi.mocked(requireUser).mockRejectedValue(redirected);

    await expect(download(version.id)).rejects.toBe(redirected);
    expect(documentStorageForRequest).not.toHaveBeenCalled();
  });
});
