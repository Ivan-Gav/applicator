import { type NextRequest, NextResponse } from "next/server";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { documentStorageForRequest } from "@/adapters/supabase/document.storage";
import { requireUser } from "@/app/auth/_utils/require-user";
import { documentFileOpenParam } from "@/app/routes";
import { formatDetails } from "@/domain/document/format";
import { documentIdSchema } from "@/domain/document/schema";
import { FileDeliveryKind, FileDisposition } from "@/domain/document/storage";
import { contentDisposition } from "@/lib/content-disposition";

// A delivery is per user and, for a redirect, expires within a minute.
const noStore = { "Cache-Control": "private, no-store" };

/**
 * The file of one of the user's document versions, saved under its original
 * name, or shown when `?open` asks for it and browsers can show its format.
 * Another user's version is not found, as is a missing one.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/document-files/[versionId]">,
) {
  const user = await requireUser();
  const versionId = documentIdSchema.safeParse((await params).versionId);
  if (!versionId.success) {
    return new NextResponse(null, { status: 404, headers: noStore });
  }
  const repository = await documentRepositoryForRequest();
  const version = await repository.findVersion(user.id, versionId.data);
  if (!version) {
    return new NextResponse(null, { status: 404, headers: noStore });
  }

  const { mediaType, opensInBrowser } = formatDetails[version.format];
  const disposition =
    request.nextUrl.searchParams.has(documentFileOpenParam) && opensInBrowser
      ? FileDisposition.Inline
      : FileDisposition.Attachment;
  const storage = await documentStorageForRequest();
  const delivery = await storage.deliver(version.storageKey, {
    fileName: version.fileName,
    mediaType,
    disposition,
  });
  switch (delivery.kind) {
    case FileDeliveryKind.Redirect:
      return NextResponse.redirect(delivery.url, { status: 307, headers: noStore });
    case FileDeliveryKind.Content:
      return new NextResponse(delivery.body, {
        headers: {
          ...noStore,
          // The allowlist's type, which the upload checked against the content; never sniffed.
          "Content-Type": mediaType,
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": contentDisposition(disposition, version.fileName),
        },
      });
  }
}
