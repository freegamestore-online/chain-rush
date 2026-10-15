import { COLS, ROWS, type Grid, createGrid, getTile, setTile } from "./grid";

/** Drops every column's tiles to the bottom, keeping their order. Returns a new grid. */
export function applyGravity(grid: Grid): Grid {
  const next = createGrid();
  for (let col = 0; col < COLS; col++) {
    let writeRow = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row--) {
      const tile = getTile(grid, { row, col });
      if (tile !== null) {
        setTile(next, { row: writeRow, col }, tile);
        writeRow--;
      }
    }
  }
  return next;
}
