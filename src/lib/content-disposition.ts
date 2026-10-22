/**
 * A Content-Disposition value that shows (`inline`) or saves (`attachment`)
 * the response as `fileName`. The plain `filename` is an ASCII stand-in for
 * clients without RFC 6266 support; `filename*` carries the name as it is.
 */
export function contentDisposition(type: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  // encodeURIComponent leaves these as they are; RFC 8187 does not allow them unencoded.
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
