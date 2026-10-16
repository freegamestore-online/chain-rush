export const COLS = 5;
export const ROWS = 8;

/** A tile value (a power of two, at least 2) or `null` for an empty cell. */
export type Tile = number | null;

/** Row-major board: `grid[row][col]`. Row 0 is the top; gravity pulls toward row ROWS - 1. */
export type Grid = Tile[][];

export interface Pos {
  row: number;
  col: number;
}

export function createGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array<Tile>(COLS).fill(null));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function inBounds({ row, col }: Pos): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function getTile(grid: Grid, { row, col }: Pos): Tile {
  return grid[row]?.[col] ?? null;
}

/** Mutates `grid` in place. Callers that need the original should `cloneGrid` first. */
export function setTile(grid: Grid, { row, col }: Pos, tile: Tile): void {
  const cells = grid[row];
  if (cells) cells[col] = tile;
}

/** True for the eight surrounding cells (diagonals included). A cell is not adjacent to itself. */
export function isAdjacent(a: Pos, b: Pos): boolean {
  const dRow = Math.abs(a.row - b.row);
  const dCol = Math.abs(a.col - b.col);
  return (dRow !== 0 || dCol !== 0) && dRow <= 1 && dCol <= 1;
}

export function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  const exponent = Math.floor(Math.log2(n));
  return 2 ** exponent === n;
}

/** Smallest power of two that is >= n (n >= 1). */
export function nextPowerOfTwoAtLeast(n: number): number {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

/** Largest tile on the board, or 0 when the board is empty. */
export function highestTile(grid: Grid): number {
  let highest = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile !== null && tile > highest) highest = tile;
    }
  }
  return highest;
}
