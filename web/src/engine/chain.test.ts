import { describe, expect, it } from "vitest";
import { chainSum, hasValidChain, isValidChain } from "./chain";
import { type Grid, type Pos, createGrid, getTile, setTile } from "./grid";

/** Builds a grid from rows of tile values; `0` means empty. */
function boardFrom(rows: number[][]): Grid {
  const grid = createGrid();
  rows.forEach((values, row) =>
    values.forEach((value, col) => setTile(grid, { row, col }, value === 0 ? null : value)),
  );
  return grid;
}

describe("isValidChain", () => {
  it("accepts an equal adjacent pair", () => {
    const grid = boardFrom([
      [2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(isValidChain(grid, [{ row: 0, col: 0 }, { row: 0, col: 1 }])).toBe(true);
  });

  it("accepts equal tiles linked diagonally", () => {
    const grid = boardFrom([
      [4, 0],
      [0, 4],
    ]);
    expect(isValidChain(grid, [{ row: 0, col: 0 }, { row: 1, col: 1 }])).toBe(true);
  });

  it("accepts any number of equal tiles", () => {
    const grid = boardFrom([[2, 2, 2, 2, 0]]);
    const chain = [0, 1, 2, 3].map((col) => ({ row: 0, col }));
    expect(isValidChain(grid, chain)).toBe(true);
  });

  it("accepts the 2-2-4-8 doubling pattern after an equal pair", () => {
    const grid = boardFrom([
      [2, 2, 0, 0, 0],
      [0, 4, 8, 0, 0],
    ]);
    const chain: Pos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ];
    expect(isValidChain(grid, chain)).toBe(true);
  });

  it("rejects a single tile", () => {
    const grid = boardFrom([[2, 0, 0, 0, 0]]);
    expect(isValidChain(grid, [{ row: 0, col: 0 }])).toBe(false);
  });

  it("rejects an empty chain", () => {
    expect(isValidChain(createGrid(), [])).toBe(false);
  });

  it("rejects tiles that are not adjacent", () => {
    const grid = boardFrom([[2, 0, 2, 0, 0]]);
    expect(isValidChain(grid, [{ row: 0, col: 0 }, { row: 0, col: 2 }])).toBe(false);
  });

  it("rejects a chain that revisits a cell", () => {
    const grid = boardFrom([
      [2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const chain = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ];
    expect(isValidChain(grid, chain)).toBe(false);
  });

  it("rejects a chain through an empty cell", () => {
    const grid = boardFrom([[2, 0, 2, 0, 0]]);
    const chain = [0, 1, 2].map((col) => ({ row: 0, col }));
    expect(isValidChain(grid, chain)).toBe(false);
  });

  it("rejects ascending values with no equal starting pair", () => {
    const grid = boardFrom([[2, 4, 8, 0, 0]]);
    const chain = [0, 1, 2].map((col) => ({ row: 0, col }));
    expect(isValidChain(grid, chain)).toBe(false);
  });

  it("rejects a pair followed by a repeated value instead of a double", () => {
    const grid = boardFrom([[2, 2, 2, 4, 0]]);
    const chain = [0, 1, 2, 3].map((col) => ({ row: 0, col }));
    expect(isValidChain(grid, chain)).toBe(false);
  });

  it("rejects a doubling step that skips a power of two", () => {
    const grid = boardFrom([[2, 2, 8, 0, 0]]);
    const chain = [0, 1, 2].map((col) => ({ row: 0, col }));
    expect(isValidChain(grid, chain)).toBe(false);
  });
});

describe("chainSum", () => {
  it("adds the values along the chain", () => {
    const grid = boardFrom([[2, 2, 4, 8, 0]]);
    const chain = [0, 1, 2, 3].map((col) => ({ row: 0, col }));
    expect(chainSum(grid, chain)).toBe(16);
  });
});

/** Values cycle so that no two tiles touching in any of the 8 directions are equal. */
function noEqualNeighboursBoard(): Grid {
  const rows = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => 2 ** (((row + 2 * col) % 5) + 1)),
  );
  return boardFrom(rows);
}

describe("hasValidChain", () => {
  it("is false when no two touching tiles are equal", () => {
    expect(hasValidChain(noEqualNeighboursBoard())).toBe(false);
  });

  it("is true when equal tiles touch only diagonally", () => {
    const grid = noEqualNeighboursBoard();
    const diagonal = { row: 3, col: 3 };
    setTile(grid, { row: 4, col: 4 }, getTile(grid, diagonal));
    expect(hasValidChain(grid)).toBe(true);
  });

  it("is false for an empty board", () => {
    expect(hasValidChain(createGrid())).toBe(false);
  });
});
