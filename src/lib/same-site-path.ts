const probeOrigin = "http://same-site.invalid";

function isSameSiteAbsolutePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  // The URL parser drops tabs and newlines and treats `\` as `/`, so "/\t/evil.com"
  // passes the prefix check above yet resolves to another host.
  return new URL(value, probeOrigin).origin === probeOrigin;
}

/**
 * `value` when it is a path on this site, otherwise null. The decoded form is
 * checked too: a query string may decode it once more.
 */
export function sameSitePath(value: unknown): string | null {
  if (typeof value !== "string" || !isSameSiteAbsolutePath(value)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return isSameSiteAbsolutePath(decoded) ? value : null;
}
