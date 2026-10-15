import { describe, expect, it } from "vitest";
import { COLS, ROWS, type Grid, createGrid, getTile, setTile } from "./grid";
import { createRng } from "./rng";
import { MAX_SPAWN_EXPONENT, refill, spawnExponentCap, spawnValue } from "./spawn";

function boardWithSeedTiles(): Grid {
  const grid = createGrid();
  setTile(grid, { row: ROWS - 1, col: 0 }, 2);
  setTile(grid, { row: ROWS - 2, col: 2 }, 4);
  setTile(grid, { row: ROWS - 1, col: 4 }, 8);
  return grid;
}

/** Highest tile 64 gives spawn values from 2 up to 16, so the RNG shows in the result. */
function boardWithBigTile(): Grid {
  const grid = boardWithSeedTiles();
  setTile(grid, { row: 0, col: 3 }, 64);
  return grid;
}

function allTiles(grid: Grid): number[] {
  return grid.flat().filter((tile): tile is number => tile !== null);
}

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(1000));
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(1000));
    expect(seqA).not.toEqual(seqB);
  });

  it("resumes the same sequence from a saved state", () => {
    const a = createRng(99);
    Array.from({ length: 7 }, () => a.next());
    const b = createRng(a.state());
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it("keeps nextInt within [0, max) and next within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.nextInt(5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe("spawn values", () => {
  it("spawns only 2 or 4 while the highest tile is still small", () => {
    expect(spawnExponentCap(0)).toBe(2);
    expect(spawnExponentCap(32)).toBe(3);
    const rng = createRng(3);
    const values = new Set(Array.from({ length: 200 }, () => spawnValue(rng, 16)));
    expect([...values].sort()).toEqual([2, 4]);
  });

  it("widens the spawn range as the highest tile grows, up to the cap", () => {
    expect(spawnExponentCap(64)).toBe(4);
    expect(spawnExponentCap(2 ** 20)).toBe(MAX_SPAWN_EXPONENT);
  });

  it("always spawns a power of two within the cap", () => {
    const rng = createRng(11);
    const cap = 2 ** (1 + spawnExponentCap(64));
    for (let i = 0; i < 200; i++) {
      const value = spawnValue(rng, 64);
      expect(value).toBeLessThanOrEqual(cap);
      expect(Number.isInteger(Math.log2(value))).toBe(true);
    }
  });
});

describe("refill", () => {
  it("fills every cell and keeps existing tiles in their settled order", () => {
    const { grid: filled } = refill(boardWithSeedTiles(), createRng(5));

    expect(filled.flat().every((tile) => tile !== null)).toBe(true);
    // Seeded tiles fall to the bottom of their columns; spawns stack above them.
    expect(getTile(filled, { row: ROWS - 1, col: 0 })).toBe(2);
    expect(getTile(filled, { row: ROWS - 1, col: 2 })).toBe(4);
    expect(getTile(filled, { row: ROWS - 1, col: 4 })).toBe(8);
  });

  it("spawns only 2 or 4 while the board's highest tile is 8", () => {
    // Seeded board has 2, 4 and 8. Every other tile is spawned, so each must be a 2 or a 4.
    const filled = allTiles(refill(boardWithSeedTiles(), createRng(9)).grid);
    expect(filled).toHaveLength(COLS * ROWS);
    expect(filled.filter((tile) => tile === 8)).toHaveLength(1);
    expect(filled.filter((tile) => tile === 2 || tile === 4)).toHaveLength(COLS * ROWS - 1);
  });

  it("reports spawned cells as the top rows of each column", () => {
    const seeded = boardWithSeedTiles();
    const { spawned } = refill(seeded, createRng(6));
    // Column 0 had one tile, so 7 spawns. Column 2 likewise. Column 1 was empty, so 8 spawns.
    const perColumn = (col: number) => spawned.filter((p) => p.col === col).map((p) => p.row).sort((a, b) => a - b);
    expect(perColumn(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(perColumn(1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(perColumn(4)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("is deterministic under a seed: same seed, same board", () => {
    const a = refill(boardWithBigTile(), createRng(2024)).grid;
    const b = refill(boardWithBigTile(), createRng(2024)).grid;
    expect(a).toEqual(b);
  });

  it("produces a different board for a different seed", () => {
    const a = refill(boardWithBigTile(), createRng(1)).grid;
    const b = refill(boardWithBigTile(), createRng(2)).grid;
    expect(a).not.toEqual(b);
  });

  it("does not modify the input grid", () => {
    const grid = boardWithSeedTiles();
    refill(grid, createRng(4));
    expect(grid.flat().filter((tile) => tile !== null)).toHaveLength(3);
  });
});
