import { createClient } from "@supabase/supabase-js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FileDeliveryKind, FileDisposition } from "@/domain/document/storage";
import type { Database } from "./database.types";
import { SupabaseDocumentStorage } from "./document.storage";
import { fakeAnonKey, fakeSupabaseUrl } from "./proxy-session.fixtures";
import { documentsBucket } from "./storage.constants";

const storageApi = `${fakeSupabaseUrl}/storage/v1`;
const owner = "00000000-0000-4000-8000-00000000000a";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function storage() {
  return new SupabaseDocumentStorage(createClient<Database>(fakeSupabaseUrl, fakeAnonKey));
}

// A file entry as the list endpoint returns it.
function fileEntry(name: string, createdAt = "2026-10-01T09:00:00.000Z") {
  return {
    name,
    id: `id-${name}`,
    created_at: createdAt,
    updated_at: createdAt,
    last_accessed_at: createdAt,
    metadata: { size: 1 },
  };
}

function folderEntry(name: string) {
  return {
    name,
    id: null,
    created_at: null,
    updated_at: null,
    last_accessed_at: null,
    metadata: null,
  };
}

describe("SupabaseDocumentStorage", () => {
  it("saves under the owner's folder with a generated name and the given type, never overwriting", async () => {
    // The type the browser declared; the stored type must be the one passed to save().
    const upload = new File(["%PDF-"], "cv.pdf", { type: "application/octet-stream" });
    let request: { path: string; contentType: string | null; upsert: string | null } | null = null;
    server.use(
      http.post(`${storageApi}/object/${documentsBucket}/*`, ({ request: received }) => {
        request = {
          path: new URL(received.url).pathname,
          contentType: received.headers.get("content-type"),
          upsert: received.headers.get("x-upsert"),
        };
        return HttpResponse.json({ Key: "ignored" });
      }),
    );

    const key = await storage().save(owner, upload, "application/pdf");

    expect(key).toMatch(new RegExp(`^${owner}/[0-9a-f-]{36}$`));
    expect(request).toEqual({
      path: `/storage/v1/object/${documentsBucket}/${key}`,
      contentType: "application/pdf",
      upsert: "false",
    });
  });

  it("hands over the bytes of a file to show, so the app can name it", async () => {
    server.use(
      http.get(`${storageApi}/object/${documentsBucket}/${owner}/f`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("%PDF-1.7").buffer, {
          headers: { "Content-Type": "application/pdf" },
        }),
      ),
    );

    const delivery = await storage().deliver(`${owner}/f`, {
      fileName: "cv.pdf",
      mediaType: "application/pdf",
      disposition: FileDisposition.Inline,
    });

    expect(delivery.kind).toBe(FileDeliveryKind.Content);
    expect(delivery.kind === FileDeliveryKind.Content ? await delivery.body.text() : null).toBe(
      "%PDF-1.7",
    );
  });

  it("delivers a file to save as a short-lived signed address that downloads under the original name", async () => {
    let expiresIn: unknown;
    server.use(
      http.post(`${storageApi}/object/sign/${documentsBucket}/*`, async ({ request }) => {
        ({ expiresIn } = (await request.json()) as { expiresIn: unknown });
        return HttpResponse.json({
          signedURL: `/object/sign/${documentsBucket}/${owner}/f?token=t`,
        });
      }),
    );

    const delivery = await storage().deliver(`${owner}/f`, {
      fileName: "cv.pdf",
      mediaType: "application/pdf",
      disposition: FileDisposition.Attachment,
    });

    expect(expiresIn).toBe(60);
    expect(delivery).toEqual({
      kind: FileDeliveryKind.Redirect,
      url: `${storageApi}/object/sign/${documentsBucket}/${owner}/f?token=t&download=cv.pdf`,
    });
  });

  it("removes the given keys, and asks nothing for none", async () => {
    const removed: unknown[] = [];
    server.use(
      http.delete(`${storageApi}/object/${documentsBucket}`, async ({ request }) => {
        removed.push(await request.json());
        return HttpResponse.json([]);
      }),
    );

    await storage().remove([]);
    await storage().remove([`${owner}/a`, `${owner}/b`]);

    expect(removed).toEqual([{ prefixes: [`${owner}/a`, `${owner}/b`] }]);
  });

  it("lists every file in every owner's folder, page by page", async () => {
    const other = "00000000-0000-4000-8000-00000000000b";
    const many = Array.from({ length: 1001 }, (_, index) => fileEntry(`f${index}`));
    server.use(
      http.post(`${storageApi}/object/list/${documentsBucket}`, async ({ request }) => {
        const { prefix, offset, limit } = (await request.json()) as {
          prefix: string;
          offset: number;
          limit: number;
        };
        const entries =
          prefix === ""
            ? [folderEntry(owner), folderEntry(other), fileEntry("stray")]
            : prefix === owner
              ? many
              : [fileEntry("only", "2026-09-01T00:00:00.000Z")];
        return HttpResponse.json(entries.slice(offset, offset + limit));
      }),
    );

    const files = await storage().listAll();

    expect(files).toHaveLength(1 + 1001 + 1);
    expect(files).toContainEqual({ key: "stray", createdAt: new Date("2026-10-01T09:00:00Z") });
    expect(files).toContainEqual({
      key: `${owner}/f1000`,
      createdAt: new Date("2026-10-01T09:00:00Z"),
    });
    expect(files).toContainEqual({
      key: `${other}/only`,
      createdAt: new Date("2026-09-01T00:00:00Z"),
    });
  });

  it("reports a failed upload instead of returning a key", async () => {
    server.use(
      http.post(`${storageApi}/object/${documentsBucket}/*`, () =>
        HttpResponse.json(
          {
            statusCode: "403",
            error: "Unauthorized",
            message: "new row violates row-level security policy",
          },
          { status: 400 },
        ),
      ),
    );

    await expect(storage().save(owner, new Blob(["x"]), "text/plain")).rejects.toThrow(
      /upload failed: new row violates row-level security policy/,
    );
  });
});
