import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { documentStorageForRequest } from "@/adapters/supabase/document.storage";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes, signInPath } from "@/app/routes";
import { maxDocumentFileBytes } from "@/domain/document/format";
import { DocumentUploadFailure } from "@/domain/document/model";
import { documentFormField } from "@/domain/document/schema";
import { InMemoryDocumentRepository } from "@/test/in-memory-document.repository";
import { InMemoryDocumentStorage } from "@/test/in-memory-document.storage";
import { addDocumentVersion, deleteDocument, renameDocument, uploadDocument } from "./actions";

vi.mock("@/adapters/supabase/document.repository", () => ({
  documentRepositoryForRequest: vi.fn(),
}));
vi.mock("@/adapters/supabase/document.storage", () => ({ documentStorageForRequest: vi.fn() }));
vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// after() needs a Next.js request; here it only records the work, which afterResponse() runs.
vi.mock("next/server", () => ({ after: vi.fn() }));

class Redirected extends Error {}

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};
const otherUser = "00000000-0000-4000-8000-00000000000b";
const missingId = "00000000-0000-4000-8000-0000000000ff";

const pdfContent = "%PDF-1.7\n1 0 obj\n";

// The browser's declared type is not trusted; the stored one comes from the allowlist.
function pdf(name = "cv.pdf") {
  return new File([pdfContent], name, { type: "application/octet-stream" });
}

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

const f = documentFormField;
const details = { [f.type]: "cv", [f.title]: "CV, English", [f.language]: "en", [f.label]: "" };

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

function signedOut() {
  vi.mocked(requireUser).mockRejectedValue(new Redirected(signInPath()));
}

async function uploaded(owner = sessionUser.id) {
  const key = await storage.save(owner, pdf(), "application/pdf");
  return repository.create(
    owner,
    { type: "cv", title: "CV", language: null },
    { storageKey: key, fileName: "cv.pdf", format: "pdf", sizeBytes: 100, label: null },
  );
}

describe("uploadDocument", () => {
  it("stores the file under a generated key, then a document naming it", async () => {
    await expect(
      uploadDocument(
        form({ ...details, [f.file]: pdf("Lebenslauf (final).pdf"), [f.label]: "short" }),
      ),
    ).resolves.toEqual({ failure: null });

    const [key] = storage.keys();
    expect(key).toMatch(new RegExp(`^${sessionUser.id}/[0-9a-f-]{36}$`));
    expect(storage.get(key ?? "")?.mediaType).toBe("application/pdf");
    const [entry] = repository.all();
    expect(entry?.userId).toBe(sessionUser.id);
    expect(entry?.document).toMatchObject({
      type: "cv",
      title: "CV, English",
      language: "en",
      versions: [
        {
          storageKey: key,
          fileName: "Lebenslauf (final).pdf",
          format: "pdf",
          sizeBytes: pdfContent.length,
          label: "short",
        },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith(routes.documents);
  });

  it.each([
    ["no file", { ...details }, DocumentUploadFailure.Invalid],
    ["no title", { ...details, [f.title]: " ", [f.file]: pdf() }, DocumentUploadFailure.Invalid],
    [
      "an unknown type",
      { ...details, [f.type]: "passport", [f.file]: pdf() },
      DocumentUploadFailure.Invalid,
    ],
    [
      "an empty file",
      { ...details, [f.file]: new File([], "cv.pdf") },
      DocumentUploadFailure.Empty,
    ],
    [
      "a file over the limit",
      {
        ...details,
        [f.file]: new File([pdfContent, new Uint8Array(maxDocumentFileBytes)], "cv.pdf"),
      },
      DocumentUploadFailure.TooLarge,
    ],
    [
      "a type not on the list",
      { ...details, [f.file]: new File(["<script>"], "cv.html") },
      DocumentUploadFailure.UnsupportedType,
    ],
    [
      "content that is not what the extension says",
      { ...details, [f.file]: new File(["MZ executable"], "cv.pdf") },
      DocumentUploadFailure.ContentMismatch,
    ],
  ])("refuses %s and stores nothing", async (_, fields, failure) => {
    await expect(uploadDocument(form(fields))).resolves.toEqual({ failure });

    expect(storage.keys()).toEqual([]);
    expect(repository.all()).toEqual([]);
  });

  it("removes the file again when the document cannot be stored", async () => {
    vi.spyOn(repository, "create").mockRejectedValue(new Error("database down"));

    await expect(uploadDocument(form({ ...details, [f.file]: pdf() }))).rejects.toThrow(
      "database down",
    );

    expect(storage.keys()).toEqual([]);
  });

  it("stores nothing without a session", async () => {
    signedOut();

    await expect(uploadDocument(form({ ...details, [f.file]: pdf() }))).rejects.toBeInstanceOf(
      Redirected,
    );

    expect(documentStorageForRequest).not.toHaveBeenCalled();
  });
});

describe("addDocumentVersion", () => {
  it("adds the file as the newest version", async () => {
    const document = await uploaded();

    await expect(
      addDocumentVersion(document.id, form({ [f.file]: pdf("cv-v2.pdf"), [f.label]: "v2" })),
    ).resolves.toEqual({ failure: null });

    const stored = await repository.find(sessionUser.id, document.id);
    expect(stored?.versions.map((version) => version.fileName)).toEqual(["cv-v2.pdf", "cv.pdf"]);
    expect(storage.keys()).toHaveLength(2);
  });

  it("refuses another user's document and removes the file it stored", async () => {
    const theirs = await uploaded(otherUser);

    await expect(addDocumentVersion(theirs.id, form({ [f.file]: pdf() }))).resolves.toEqual({
      failure: DocumentUploadFailure.Missing,
    });

    expect((await repository.find(otherUser, theirs.id))?.versions).toHaveLength(1);
    expect(await storage.listOwnedBy(sessionUser.id)).toEqual([]);
  });

  it("refuses an id that is not one without storing anything", async () => {
    await expect(addDocumentVersion("not-a-uuid", form({ [f.file]: pdf() }))).resolves.toEqual({
      failure: DocumentUploadFailure.Invalid,
    });
    expect(storage.keys()).toEqual([]);
  });

  it("refuses a file the checks refuse", async () => {
    const document = await uploaded();

    await expect(
      addDocumentVersion(document.id, form({ [f.file]: new File(["text"], "cv.exe") })),
    ).resolves.toEqual({ failure: DocumentUploadFailure.UnsupportedType });
  });
});

describe("renameDocument", () => {
  it("renames the document", async () => {
    const document = await uploaded();

    await expect(renameDocument(document.id, "  CV, German  ")).resolves.toBe(true);

    expect((await repository.find(sessionUser.id, document.id))?.title).toBe("CV, German");
  });

  it.each([
    ["a blank title", " "],
    ["a title over 200 characters", "x".repeat(201)],
    ["no title", undefined],
  ])("refuses %s", async (_, title) => {
    const document = await uploaded();

    await expect(renameDocument(document.id, title)).resolves.toBe(false);

    expect((await repository.find(sessionUser.id, document.id))?.title).toBe("CV");
  });

  it("does not rename another user's document", async () => {
    const theirs = await uploaded(otherUser);

    await expect(renameDocument(theirs.id, "Mine")).resolves.toBe(false);

    expect((await repository.find(otherUser, theirs.id))?.title).toBe("CV");
  });
});

/** Runs the work the action left for after its response, in order. */
async function afterResponse() {
  for (const [task] of vi.mocked(after).mock.calls) {
    await (typeof task === "function" ? task() : task);
  }
}

describe("deleteDocument", () => {
  it("answers once the rows are gone, and removes the files after the response", async () => {
    const document = await uploaded();
    await addDocumentVersion(document.id, form({ [f.file]: pdf("cv-v2.pdf") }));
    const deleteRows = vi.spyOn(repository, "delete");
    const removeFiles = vi.spyOn(storage, "remove");

    await deleteDocument(document.id);

    expect(await repository.find(sessionUser.id, document.id)).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(routes.documents);
    expect(removeFiles).not.toHaveBeenCalled();
    expect(storage.keys()).toHaveLength(2);

    await afterResponse();

    expect(storage.keys()).toEqual([]);
    expect(deleteRows.mock.invocationCallOrder[0]).toBeLessThan(
      removeFiles.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("tries removing the files a second time when the first attempt fails", async () => {
    const document = await uploaded();
    const removeForReal = storage.remove.bind(storage);
    const remove = vi
      .spyOn(storage, "remove")
      .mockRejectedValueOnce(new Error("storage hiccup"))
      .mockImplementation(removeForReal);

    await deleteDocument(document.id);
    await afterResponse();

    expect(remove).toHaveBeenCalledTimes(2);
    expect(storage.keys()).toEqual([]);
  });

  it("leaves the files behind, rows gone, when both attempts fail", async () => {
    const document = await uploaded();
    const remove = vi.spyOn(storage, "remove").mockRejectedValue(new Error("storage down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteDocument(document.id)).resolves.toBeUndefined();
    await expect(afterResponse()).resolves.toBeUndefined();

    expect(await repository.find(sessionUser.id, document.id)).toBeNull();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(storage.keys()).toHaveLength(1);
    expect(logged).toHaveBeenCalledWith(
      "Document files left in storage:",
      storage.keys(),
      expect.any(Error),
    );
  });

  it("deletes nothing of another user's", async () => {
    const theirs = await uploaded(otherUser);

    await deleteDocument(theirs.id);
    await afterResponse();

    expect(await repository.find(otherUser, theirs.id)).not.toBeNull();
    expect(storage.keys()).toHaveLength(1);
  });

  it("ignores an unknown document", async () => {
    await expect(deleteDocument(missingId)).resolves.toBeUndefined();
  });

  it("deletes nothing without a session", async () => {
    const document = await uploaded();
    signedOut();

    await expect(deleteDocument(document.id)).rejects.toBeInstanceOf(Redirected);

    expect(after).not.toHaveBeenCalled();
    expect(await repository.find(sessionUser.id, document.id)).not.toBeNull();
    expect(storage.keys()).toHaveLength(1);
  });
});
