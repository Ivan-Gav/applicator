/**
 * Where a file lives in document storage. Opaque: only the storage that
 * issued it reads it, and nothing derives a URL or an owner from it.
 */
export type StorageKey = string;

/** A file as storage lists it. */
export type StoredFile = {
  key: StorageKey;
  createdAt: Date;
};

// How the browser receives a file.
export const FileDeliveryKind = {
  // Sent on to a short-lived address the storage serves the file from.
  Redirect: "redirect",
  // The bytes, served by this app.
  Content: "content",
} as const;

export type FileDelivery =
  | { kind: typeof FileDeliveryKind.Redirect; url: string }
  | { kind: typeof FileDeliveryKind.Content; body: Blob };

// Whether the browser shows the file or saves it.
export const FileDisposition = {
  Inline: "inline",
  Attachment: "attachment",
} as const;
export type FileDisposition = (typeof FileDisposition)[keyof typeof FileDisposition];

/** How a delivered file is offered: shown or saved, under its original name either way. */
export type FileDownload = {
  fileName: string;
  mediaType: string;
  disposition: FileDisposition;
};

/**
 * Stores document files. Whoever the implementation acts for decides which
 * files it reaches: a user's request reaches that user's files only.
 */
export interface DocumentStorage {
  /** Stores the file as `ownerId`'s under a new key, and returns the key. Never overwrites. */
  save(ownerId: string, file: Blob, mediaType: string): Promise<StorageKey>;

  /** How the browser gets the file under `key`. */
  deliver(key: StorageKey, download: FileDownload): Promise<FileDelivery>;

  /** Removes the files under `keys`; a key with no file is not an error. */
  remove(keys: readonly StorageKey[]): Promise<void>;

  /** Every file stored for `ownerId`. */
  listOwnedBy(ownerId: string): Promise<StoredFile[]>;

  /** Every file this storage reaches, whoever owns it. */
  listAll(): Promise<StoredFile[]>;
}
