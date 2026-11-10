import type { AttachedVersion } from "./model";

/** A document as attaching needs it: its versions newest first, the first being current. */
export type DocumentToAttach = {
  id: string;
  versions: readonly { id: string }[];
};

export function isAttached(attached: readonly AttachedVersion[], documentId: string): boolean {
  return attached.some((attachment) => attachment.documentId === documentId);
}

/**
 * The list with the document added last at its current version. A document
 * already attached, or one without versions, leaves the list as it is.
 */
export function withAttached(
  attached: readonly AttachedVersion[],
  document: DocumentToAttach,
): readonly AttachedVersion[] {
  const [current] = document.versions;
  if (current === undefined || isAttached(attached, document.id)) {
    return attached;
  }
  return [...attached, { documentId: document.id, versionId: current.id }];
}

/** The list with the document's attachment naming `versionId` instead, in the same place. */
export function withVersionSent(
  attached: readonly AttachedVersion[],
  documentId: string,
  versionId: string,
): readonly AttachedVersion[] {
  return attached.map((attachment) =>
    attachment.documentId === documentId ? { documentId, versionId } : attachment,
  );
}

export function withoutDocument(
  attached: readonly AttachedVersion[],
  documentId: string,
): readonly AttachedVersion[] {
  return attached.filter((attachment) => attachment.documentId !== documentId);
}

/** Whether both name the same versions in the same order. */
export function sameAttachments(
  a: readonly AttachedVersion[],
  b: readonly AttachedVersion[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (attachment, index) =>
        attachment.documentId === b[index]?.documentId &&
        attachment.versionId === b[index]?.versionId,
    )
  );
}
