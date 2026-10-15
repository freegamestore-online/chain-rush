import { applyGravity } from "./gravity";
import { COLS, type Grid, getTile, highestTile, setTile } from "./grid";
import type { Rng } from "./rng";

/** Largest spawn exponent ever used: 2^5 = 32. Tunable. */
export const MAX_SPAWN_EXPONENT = 5;

/**
 * Highest exponent a new tile can have, given the board's highest tile. Spawns stay small early
 * on and grow as the player's best tile grows: 2 up to 8, then 2-4 up to 16, and so on.
 */
export function spawnExponentCap(highest: number): number {
  const highestExponent = Math.floor(Math.log2(Math.max(highest, 1)));
  return Math.min(MAX_SPAWN_EXPONENT, Math.max(1, highestExponent - 2));
}

/** Draws a new tile value (2, 4, … up to the cap for `highest`). */
export function spawnValue(rng: Rng, highest: number): number {
  return 2 ** (1 + rng.nextInt(spawnExponentCap(highest)));
}

/**
 * Settles the board, then fills every empty cell. Tiles spawn one at a time at the top of their
 * column and fall to the lowest gap. Columns are filled left to right, so the same grid and RNG
 * state always produce the same board.
 */
export function refill(grid: Grid, rng: Rng): Grid {
  const highest = highestTile(grid);
  let next = applyGravity(grid);

  for (let col = 0; col < COLS; col++) {
    // After gravity a column's empty cells sit on top, so row 0 is empty exactly when a gap exists.
    while (getTile(next, { row: 0, col }) === null) {
      setTile(next, { row: 0, col }, spawnValue(rng, highest));
      next = applyGravity(next);
    }
  }
  return next;
}
