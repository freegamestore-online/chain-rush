import { describe, expect, it } from "vitest";
import { type Grid, type Pos, createGrid, getTile, nextPowerOfTwoAtLeast, setTile } from "./grid";
import { mergeChain } from "./merge";

function boardFrom(rows: number[][]): Grid {
  const grid = createGrid();
  rows.forEach((values, row) =>
    values.forEach((value, col) => setTile(grid, { row, col }, value === 0 ? null : value)),
  );
  return grid;
}

/** Chain across row 0, columns 0..length-1. */
const rowChain = (length: number): Pos[] => Array.from({ length }, (_, col) => ({ row: 0, col }));

describe("nextPowerOfTwoAtLeast", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [6, 8],
    [9, 16],
    [16, 16],
    [17, 32],
  ])("%i rounds up to %i", (n, expected) => {
    expect(nextPowerOfTwoAtLeast(n)).toBe(expected);
  });
});

describe("mergeChain", () => {
  it("merges an equal pair into the next power of two at the last cell", () => {
    const grid = boardFrom([[2, 2, 0, 0, 0]]);
    const result = mergeChain(grid, rowChain(2));

    expect(result?.value).toBe(4);
    expect(result?.scoreDelta).toBe(4);
    expect(getTile(result!.grid, { row: 0, col: 0 })).toBeNull();
    expect(getTile(result!.grid, { row: 0, col: 1 })).toBe(4);
  });

  it("rounds a chain sum up to the next power of two", () => {
    // 2 + 2 + 2 = 6, so the result is 8.
    const grid = boardFrom([[2, 2, 2, 0, 0]]);
    expect(mergeChain(grid, rowChain(3))?.value).toBe(8);
  });

  it("uses the exact sum when it is already a power of two", () => {
    // 2 + 2 + 4 = 8.
    const grid = boardFrom([[2, 2, 4, 0, 0]]);
    expect(mergeChain(grid, rowChain(3))?.value).toBe(8);
  });

  it("merges the 2-2-4-8 chain to 16", () => {
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
    const result = mergeChain(grid, chain);

    expect(result?.value).toBe(16);
    expect(getTile(result!.grid, { row: 1, col: 2 })).toBe(16);
    expect(getTile(result!.grid, { row: 0, col: 0 })).toBeNull();
    expect(getTile(result!.grid, { row: 0, col: 1 })).toBeNull();
    expect(getTile(result!.grid, { row: 1, col: 1 })).toBeNull();
  });

  it("clears every other chain tile and leaves tiles outside the chain alone", () => {
    const grid = boardFrom([[4, 4, 4, 4, 8]]);
    const result = mergeChain(grid, rowChain(3));

    expect(result?.value).toBe(16);
    expect(getTile(result!.grid, { row: 0, col: 3 })).toBe(4);
    expect(getTile(result!.grid, { row: 0, col: 4 })).toBe(8);
  });

  it("does not modify the input grid", () => {
    const grid = boardFrom([[2, 2, 0, 0, 0]]);
    mergeChain(grid, rowChain(2));
    expect(getTile(grid, { row: 0, col: 0 })).toBe(2);
    expect(getTile(grid, { row: 0, col: 1 })).toBe(2);
  });

  it("returns null for an invalid chain", () => {
    const grid = boardFrom([[2, 4, 0, 0, 0]]);
    expect(mergeChain(grid, rowChain(2))).toBeNull();
  });
});
