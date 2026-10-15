import { describe, expect, it } from "vitest";
import { applyGravity } from "./gravity";
import { COLS, ROWS, type Grid, createGrid, getTile, setTile } from "./grid";

function columnOf(grid: Grid, col: number): (number | null)[] {
  return Array.from({ length: ROWS }, (_, row) => getTile(grid, { row, col }));
}

describe("applyGravity", () => {
  it("drops tiles to the bottom of their column", () => {
    const grid = createGrid();
    setTile(grid, { row: 0, col: 0 }, 2);
    setTile(grid, { row: 3, col: 0 }, 4);

    const column = columnOf(applyGravity(grid), 0);
    expect(column).toEqual([...Array<null>(ROWS - 2).fill(null), 2, 4]);
  });

  it("fills gaps and keeps the vertical order of tiles", () => {
    const grid = createGrid();
    setTile(grid, { row: 1, col: 2 }, 2);
    setTile(grid, { row: 4, col: 2 }, 8);
    setTile(grid, { row: 6, col: 2 }, 4);

    const column = columnOf(applyGravity(grid), 2);
    expect(column.slice(ROWS - 3)).toEqual([2, 8, 4]);
    expect(column.slice(0, ROWS - 3).every((tile) => tile === null)).toBe(true);
  });

  it("keeps each column independent", () => {
    const grid = createGrid();
    setTile(grid, { row: 0, col: 0 }, 2);
    setTile(grid, { row: 7, col: 4 }, 16);

    const settled = applyGravity(grid);
    expect(getTile(settled, { row: ROWS - 1, col: 0 })).toBe(2);
    expect(getTile(settled, { row: ROWS - 1, col: 4 })).toBe(16);
    for (let col = 1; col < COLS - 1; col++) {
      expect(columnOf(settled, col).every((tile) => tile === null)).toBe(true);
    }
  });

  it("leaves a settled board unchanged", () => {
    const grid = createGrid();
    setTile(grid, { row: ROWS - 1, col: 1 }, 2);
    setTile(grid, { row: ROWS - 2, col: 1 }, 4);

    expect(applyGravity(grid)).toEqual(grid);
    expect(applyGravity(applyGravity(grid))).toEqual(grid);
  });

  it("does not modify the input grid", () => {
    const grid = createGrid();
    setTile(grid, { row: 0, col: 0 }, 2);
    applyGravity(grid);
    expect(getTile(grid, { row: 0, col: 0 })).toBe(2);
  });
});
