/** Smallest tile that earns a milestone. Milestones are the powers of two from here up. */
export const MILESTONE_MIN = 512;

/** A helper is earned each time the score crosses a multiple of this. */
export const HELPER_POINTS = 500;

export const HELPER_KINDS = ["hammer", "swap", "shuffle"] as const;
export type HelperKind = (typeof HELPER_KINDS)[number];
export type HelperCounts = Record<HelperKind, number>;

export const STARTING_HELPERS: Readonly<HelperCounts> = { hammer: 1, swap: 1, shuffle: 1 };

/**
 * Milestones reached when the best tile goes from `celebrated` to `highest`: each power of two from
 * MILESTONE_MIN that is above `celebrated` and at most `highest`. Empty when nothing new was reached.
 */
export function milestonesCrossed(celebrated: number, highest: number): number[] {
  const crossed: number[] = [];
  for (let milestone = MILESTONE_MIN; milestone <= highest; milestone *= 2) {
    if (milestone > celebrated) crossed.push(milestone);
  }
  return crossed;
}

/** How many helper points thresholds a score change passes, so one big merge can earn several. */
export function helpersEarned(previousScore: number, nextScore: number): number {
  return Math.floor(nextScore / HELPER_POINTS) - Math.floor(previousScore / HELPER_POINTS);
}
