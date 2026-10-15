const KILO = 1024;
const MEGA = KILO * KILO;

/** Smallest tile that earns a milestone celebration. */
export const MILESTONE_MIN = 512;

/** Tile label: 512, 1K, 2K, … 1M. Tiles are powers of two, so the binary units divide exactly. */
export function formatValue(value: number): string {
  if (value >= MEGA) return `${value / MEGA}M`;
  if (value >= KILO) return `${value / KILO}K`;
  return String(value);
}

export function isMilestone(value: number): boolean {
  return value >= MILESTONE_MIN && Number.isInteger(Math.log2(value));
}
