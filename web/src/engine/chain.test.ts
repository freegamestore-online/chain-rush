import { describe, expect, it } from "vitest";
import { chainSum, extendChain, hasValidChain, isValidChain } from "./chain";
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

describe("extendChain", () => {
  const at = (row: number, col: number): Pos => ({ row, col });

  it("starts a chain on any non-empty tile", () => {
    const grid = boardFrom([[2, 0, 4]]);
    expect(extendChain(grid, [], at(0, 0))).toEqual({ chain: [at(0, 0)], status: "added" });
  });

  it("ignores an empty cell", () => {
    const grid = boardFrom([[2, 0, 4]]);
    expect(extendChain(grid, [], at(0, 1)).status).toBe("unchanged");
  });

  it("adds an equal adjacent tile", () => {
    const grid = boardFrom([[2, 2, 4]]);
    const result = extendChain(grid, [at(0, 0)], at(0, 1));
    expect(result.status).toBe("added");
    expect(result.chain).toEqual([at(0, 0), at(0, 1)]);
  });

  it("rejects a non-matching adjacent tile and keeps the chain", () => {
    const grid = boardFrom([[2, 4, 0]]);
    const chain = [at(0, 0)];
    const result = extendChain(grid, chain, at(0, 1));
    expect(result.status).toBe("rejected");
    expect(result.chain).toBe(chain);
  });

  it("adds the doubling tile after an equal pair", () => {
    const grid = boardFrom([
      [2, 2, 0],
      [0, 4, 0],
    ]);
    const result = extendChain(grid, [at(0, 0), at(0, 1)], at(1, 1));
    expect(result.status).toBe("added");
  });

  it("removes the last tile when the drag steps back onto it", () => {
    const grid = boardFrom([[2, 2, 2]]);
    const result = extendChain(grid, [at(0, 0), at(0, 1)], at(0, 0));
    expect(result).toEqual({ chain: [at(0, 0)], status: "removed" });
  });

  it("ignores the current tile and non-adjacent jumps", () => {
    const grid = boardFrom([[2, 2, 2, 2]]);
    const chain = [at(0, 0), at(0, 1)];
    expect(extendChain(grid, chain, at(0, 1)).status).toBe("unchanged");
    expect(extendChain(grid, chain, at(0, 3)).status).toBe("unchanged");
  });

  it("ignores a tile already in the chain that is not the step back", () => {
    const grid = boardFrom([
      [2, 2, 2],
      [2, 2, 0],
    ]);
    const chain = [at(0, 0), at(0, 1), at(0, 2)];
    expect(extendChain(grid, chain, at(1, 1)).status).toBe("added");
    const cycle = [at(0, 0), at(0, 1), at(1, 0)];
    expect(extendChain(grid, cycle, at(0, 0)).status).toBe("unchanged");
  });
});
