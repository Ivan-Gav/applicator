/** Each value once, the most frequent first, ties alphabetically; nulls left out. */
export function mostCommonFirst(values: readonly (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.keys()].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
  );
}
