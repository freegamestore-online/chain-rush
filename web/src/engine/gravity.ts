import { COLS, ROWS } from "./grid";

/**
 * Drops every column's cells to the bottom, keeping their order. Returns a new grid. Generic over
 * the cell type, so the view can run the same move on a grid of tile ids.
 */
export function applyGravity<T>(grid: readonly (readonly (T | null)[])[]): (T | null)[][] {
  const next: (T | null)[][] = Array.from({ length: ROWS }, () => Array<T | null>(COLS).fill(null));
  for (let col = 0; col < COLS; col++) {
    let writeRow = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row--) {
      const cell = grid[row]?.[col] ?? null;
      if (cell !== null) {
        const cells = next[writeRow];
        if (cells) cells[col] = cell;
        writeRow--;
      }
    }
  }
  return next;
}
