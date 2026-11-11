/**
 * The middle value; with an even count, the mean of the middle two rounded to
 * a whole number (halves up). `null` for no values.
 */
export function roundedMedian(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] as number;
  if (sorted.length % 2 === 1) {
    return upper;
  }
  const lower = sorted[middle - 1] as number;
  return Math.round((lower + upper) / 2);
}
