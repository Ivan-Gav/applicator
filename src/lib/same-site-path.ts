const probeOrigin = "http://same-site.invalid";

function isSameSiteAbsolutePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  // The URL parser drops tabs and newlines and treats `\` as `/`, so "/\t/evil.com"
  // passes the prefix check above yet resolves to another host. Resolving it
  // the way a browser would catches every such spelling.
  return new URL(value, probeOrigin).origin === probeOrigin;
}

/**
 * `value` when it is a path on this site, otherwise null. Guards every
 * user-supplied redirect destination against pointing off-site.
 *
 * The decoded form is checked as well: a value decoded once more on its way
 * through a query string must not turn into another host.
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
