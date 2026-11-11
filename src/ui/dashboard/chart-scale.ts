// The axis never tops out below this, so one or two applications do not fill the height.
const lowestTop = 4;

/** At most this many bucket labels under the chart. */
export const mostXLabels = 14;

export type YScale = {
  /** The distance between ticks. */
  step: number;
  /** The value at the top of the axis, a multiple of `step`. */
  top: number;
};

/** Ticks a step of 1, 2, 5 or 10 apart, from 0 to at least {@link lowestTop}. */
export function yScale(largest: number): YScale {
  const max = Math.max(1, largest);
  const step = max <= 4 ? 1 : max <= 8 ? 2 : max <= 20 ? 5 : 10;
  return { step, top: Math.max(lowestTop, Math.ceil(max / step) * step) };
}

/** The values the ticks stand at, from 0 to the top. */
export function yTicks({ step, top }: YScale): number[] {
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

/** Every how many buckets a label is shown, so that at most {@link mostXLabels} are. */
export function xLabelEvery(buckets: number): number {
  return Math.max(1, Math.ceil(buckets / mostXLabels));
}
