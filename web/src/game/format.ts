const KILO = 1024;
const MEGA = KILO * KILO;

/** Tile label: 512, 1K, 2K, … 1M. Tiles are powers of two, so the binary units divide exactly. */
export function formatValue(value: number): string {
  if (value >= MEGA) return `${value / MEGA}M`;
  if (value >= KILO) return `${value / KILO}K`;
  return String(value);
}
