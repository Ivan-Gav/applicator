/** Search parameters as Next.js hands them to a page: a repeated one as an array. */
export function pageSearchParams(params: URLSearchParams): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const [name, value] of params) {
    const earlier = record[name];
    record[name] = earlier === undefined ? value : [earlier, value].flat();
  }
  return record;
}
