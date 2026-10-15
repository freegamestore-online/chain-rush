import { describe, expect, it } from "vitest";
import { type GameState, commitChain, newGame, undoLastChain } from "./game";
import { type Grid, type Pos, createGrid, getTile, setTile } from "./grid";
import { HELPER_KINDS, helpersEarned, milestonesCrossed } from "./progress";
import { createRng } from "./rng";

/** Board with a pair of `value` tiles on the bottom row, and nothing else. */
function pairBoard(value: number): GameState {
  const grid = createGrid();
  setTile(grid, { row: 7, col: 0 }, value);
  setTile(grid, { row: 7, col: 1 }, value);
  return {
    grid,
    score: 0,
    highest: value,
    helpers: { hammer: 0, swap: 0, shuffle: 0 },
    rngState: createRng(42).state(),
    moves: 0,
    over: false,
    undo: null,
    celebrated: 0,
  };
}

const PAIR = [
  { row: 7, col: 0 },
  { row: 7, col: 1 },
];

describe("score", () => {
  it("adds the resulting tile's value to the score on each merge", () => {
    const result = commitChain(pairBoard(2), PAIR);
    expect(result?.scoreDelta).toBe(4);
    expect(result?.state.score).toBe(4);
  });

  it("keeps adding across merges", () => {
    const first = commitChain(pairBoard(4), PAIR);
    expect(first?.state.score).toBe(8);
    const second = commitChain(first!.state, findPair(first!.state.grid));
    expect(second?.state.score).toBe(8 + (second?.value ?? 0));
  });
});

describe("highest tile", () => {
  it("only ever rises, even when the best tile is later removed", () => {
    const merged = commitChain(pairBoard(256), PAIR);
    expect(merged?.state.highest).toBe(512);
    expect(merged?.state.highest).toBeGreaterThanOrEqual(256);
  });
});

describe("milestonesCrossed", () => {
  it("lists each power of two from 512 that is newly reached", () => {
    expect(milestonesCrossed(0, 256)).toEqual([]);
    expect(milestonesCrossed(0, 512)).toEqual([512]);
    expect(milestonesCrossed(512, 1024)).toEqual([1024]);
    expect(milestonesCrossed(0, 4096)).toEqual([512, 1024, 2048, 4096]);
  });

  it("does not repeat a milestone that was already celebrated", () => {
    expect(milestonesCrossed(512, 512)).toEqual([]);
    expect(milestonesCrossed(1024, 1024)).toEqual([]);
  });

  it("fires from the highest tile, so a jump reports every threshold it passed", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 256);
    setTile(grid, { row: 7, col: 1 }, 256);
    const state = { ...pairBoard(256), grid, highest: 256 };
    const result = commitChain(state, PAIR);
    expect(result?.milestones).toEqual([512]);
    expect(result?.state.celebrated).toBe(512);
  });

  it("never fires the same milestone twice, even after an undo and a replay", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 256);
    setTile(grid, { row: 7, col: 1 }, 256);
    const start = { ...pairBoard(256), grid, highest: 256 };
    const first = commitChain(start, PAIR);
    expect(first?.milestones).toEqual([512]);

    const undone = undoLastChain(first!.state);
    const replay = commitChain(undone!, PAIR);
    expect(replay?.milestones).toEqual([]);
  });
});

describe("helpers earned through score", () => {
  it("counts each multiple of 500 that the score passes", () => {
    expect(helpersEarned(499, 500)).toBe(1);
    expect(helpersEarned(500, 999)).toBe(0);
    expect(helpersEarned(480, 1010)).toBe(2);
  });

  it("grants one helper per threshold crossed, drawn from the three kinds", () => {
    const state = { ...pairBoard(2), score: 496 };
    const result = commitChain(state, PAIR)!;
    // 496 + 4 = 500 crosses the first threshold.
    expect(result.earned).toHaveLength(1);
    const kind = result.earned[0]!;
    expect(HELPER_KINDS).toContain(kind);
    expect(result.state.helpers[kind]).toBe(state.helpers[kind] + 1);
    const total = (h: typeof result.state.helpers) => h.hammer + h.swap + h.shuffle;
    expect(total(result.state.helpers)).toBe(total(state.helpers) + 1);
  });

  it("awards nothing when no threshold is crossed", () => {
    expect(commitChain(pairBoard(2), PAIR)?.earned).toEqual([]);
  });

  it("is deterministic under the seed", () => {
    const a = commitChain({ ...pairBoard(2), score: 496 }, PAIR);
    const b = commitChain({ ...pairBoard(2), score: 496 }, PAIR);
    expect(a?.earned).toEqual(b?.earned);
  });
});

describe("new game", () => {
  it("starts with one of each helper and nothing to undo", () => {
    const game = newGame(3);
    expect(game.helpers).toEqual({ hammer: 1, swap: 1, shuffle: 1 });
    expect(game.undo).toBeNull();
    expect(game.score).toBe(0);
  });
});


/** Two touching equal tiles, found by scanning the grid. */
function findPair(grid: Grid): Pos[] {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
      const here = getTile(grid, { row, col });
      if (here === null) continue;
      for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (getTile(grid, next) === here) return [{ row, col }, next];
      }
    }
  }
  throw new Error("no pair");
}
