import { applyGravity } from "./gravity";
import { COLS, type Grid, type Pos, getTile, highestTile, setTile } from "./grid";
import type { Rng } from "./rng";

/** Largest spawn exponent ever used: 2^5 = 32. Tunable. */
export const MAX_SPAWN_EXPONENT = 5;

/** Smallest spawn cap: new tiles are 2 or 4 from the start. */
const MIN_SPAWN_EXPONENT = 2;

/**
 * Highest exponent a new tile can have, given the board's highest tile. Spawns start at 2 or 4 and
 * widen as the best tile grows: up to 8 from a 32, up to 16 from a 64, and so on.
 */
export function spawnExponentCap(highest: number): number {
  const highestExponent = Math.floor(Math.log2(Math.max(highest, 1)));
  return Math.min(MAX_SPAWN_EXPONENT, Math.max(MIN_SPAWN_EXPONENT, highestExponent - 2));
}

/** Draws a new tile value: 2, 4, … up to the cap for `highest`. */
export function spawnValue(rng: Rng, highest: number): number {
  return 2 ** (1 + rng.nextInt(spawnExponentCap(highest)));
}

export interface RefillResult {
  grid: Grid;
  /**
   * Cells that received a new tile. In each column they are the top rows, directly above the
   * tiles that were already there.
   */
  spawned: Pos[];
}

/**
 * Settles the board, then fills every empty cell. Tiles spawn one at a time at the top of their
 * column and fall onto the stack. Columns are filled left to right, so the same grid and RNG
 * state always produce the same board.
 */
export function refill(grid: Grid, rng: Rng): RefillResult {
  const highest = highestTile(grid);
  let next = applyGravity(grid);
  const spawned: Pos[] = [];

  for (let col = 0; col < COLS; col++) {
    let count = 0;
    // After gravity a column's empty cells sit on top, so row 0 is empty exactly when a gap exists.
    while (getTile(next, { row: 0, col }) === null) {
      setTile(next, { row: 0, col }, spawnValue(rng, highest));
      next = applyGravity(next);
      count++;
    }
    for (let row = 0; row < count; row++) spawned.push({ row, col });
  }
  return { grid: next, spawned };
}
