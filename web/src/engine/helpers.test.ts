import { describe, expect, it } from "vitest";
import { hasValidChain } from "./chain";
import { type GameState, commitChain, newGame, undoLastChain } from "./game";
import { type Grid, cloneGrid, getTile, setTile } from "./grid";
import { useHammer, useShuffle, useSwap } from "./helpers";

function withHelpers(state: GameState, helpers: Partial<GameState["helpers"]>): GameState {
  return { ...state, helpers: { ...state.helpers, ...helpers } };
}

/** Opening board for a seed, with the given helper counts. */
function game(seed: number, helpers: Partial<GameState["helpers"]> = {}): GameState {
  return withHelpers(newGame(seed), helpers);
}

function valuesOf(grid: Grid): number[] {
  return grid.flat().filter((t): t is number => t !== null).sort((a, b) => a - b);
}

describe("hammer", () => {
  it("removes the chosen tile, refills the board, and spends one hammer", () => {
    const state = game(11, { hammer: 2 });
    const target = { row: 3, col: 2 };
    const result = useHammer(state, target);

    expect(result).not.toBeNull();
    expect(result?.state.helpers.hammer).toBe(1);
    expect(result?.state.grid.flat().every((t) => t !== null)).toBe(true);
    expect(result?.spawned.length).toBe(1);
  });

  it("returns null when there are no hammers left", () => {
    expect(useHammer(game(11, { hammer: 0 }), { row: 0, col: 0 })).toBeNull();
  });

  it("returns null on an empty cell", () => {
    const state = game(11, { hammer: 1 });
    const grid = cloneGrid(state.grid);
    setTile(grid, { row: 0, col: 0 }, null);
    expect(useHammer({ ...state, grid }, { row: 0, col: 0 })).toBeNull();
  });

  it("does not change the undo snapshot", () => {
    const state = game(11, { hammer: 1 });
    const played = commitChain(state, findPair(state.grid))!.state;
    const after = useHammer(played, { row: 0, col: 0 });
    expect(after?.state.undo).toEqual(played.undo);
  });
});

describe("swap", () => {
  it("swaps two tiles' values and spends one swap", () => {
    const state = game(5, { swap: 1 });
    const a = { row: 0, col: 0 };
    const b = { row: 7, col: 4 };
    const valueA = getTile(state.grid, a);
    const valueB = getTile(state.grid, b);
    const result = useSwap(state, a, b);

    expect(getTile(result!.state.grid, a)).toBe(valueB);
    expect(getTile(result!.state.grid, b)).toBe(valueA);
    expect(result?.state.helpers.swap).toBe(0);
  });

  it("returns null with no swaps left, on the same cell, or on an empty cell", () => {
    const state = game(5, { swap: 0 });
    expect(useSwap(state, { row: 0, col: 0 }, { row: 0, col: 1 })).toBeNull();

    const ready = game(5, { swap: 1 });
    expect(useSwap(ready, { row: 0, col: 0 }, { row: 0, col: 0 })).toBeNull();

    const grid = cloneGrid(ready.grid);
    setTile(grid, { row: 0, col: 1 }, null);
    expect(useSwap({ ...ready, grid }, { row: 0, col: 0 }, { row: 0, col: 1 })).toBeNull();
  });
});

describe("shuffle", () => {
  it("keeps the same tile values and spends one shuffle", () => {
    const state = game(9, { shuffle: 1 });
    const result = useShuffle(state);

    expect(valuesOf(result!.state.grid)).toEqual(valuesOf(state.grid));
    expect(result?.state.helpers.shuffle).toBe(0);
    expect(hasValidChain(result!.state.grid)).toBe(result!.state.over === false);
  });

  it("actually rearranges the board for a seed with varied tiles", () => {
    const state = game(9, { shuffle: 1 });
    const result = useShuffle(state);
    expect(result?.state.grid).not.toEqual(state.grid);
  });

  it("is deterministic under the RNG state", () => {
    const state = game(9, { shuffle: 1 });
    expect(useShuffle(state)?.state.grid).toEqual(useShuffle(state)?.state.grid);
  });

  it("returns null with no shuffles left", () => {
    expect(useShuffle(game(9, { shuffle: 0 }))).toBeNull();
  });
});

describe("helper counters", () => {
  it("cannot be used past zero, and a helper spent to zero then declines", () => {
    let state = game(21, { swap: 1 });
    state = useSwap(state, { row: 0, col: 0 }, { row: 0, col: 1 })!.state;
    expect(state.helpers.swap).toBe(0);
    expect(useSwap(state, { row: 1, col: 0 }, { row: 1, col: 1 })).toBeNull();
  });
});

describe("undo", () => {
  it("restores the board, score, highest tile, helpers, and RNG from before the chain", () => {
    const start = game(14, { hammer: 1 });
    const pair = findPair(start.grid);
    const played = commitChain(start, pair)!.state;
    const restored = undoLastChain(played);

    expect(restored?.grid).toEqual(start.grid);
    expect(restored?.score).toBe(start.score);
    expect(restored?.highest).toBe(start.highest);
    expect(restored?.helpers).toEqual(start.helpers);
    expect(restored?.rngState).toBe(start.rngState);
    expect(restored?.undo).toBeNull();
  });

  it("is unavailable once used, and until the next chain", () => {
    const start = game(14);
    const played = commitChain(start, findPair(start.grid))!.state;
    const once = undoLastChain(played)!;
    expect(undoLastChain(once)).toBeNull();

    const again = commitChain(once, findPair(once.grid));
    expect(again?.state.undo).not.toBeNull();
  });

  it("undoes the helper used after a chain too, since it restores the whole prior state", () => {
    const start = game(14, { swap: 1 });
    const played = commitChain(start, findPair(start.grid))!.state;
    const swapped = useSwap(played, { row: 0, col: 0 }, { row: 0, col: 1 })!.state;
    const restored = undoLastChain(swapped);
    expect(restored?.helpers.swap).toBe(start.helpers.swap);
    expect(restored?.grid).toEqual(start.grid);
  });

  it("is null when there has been no chain yet", () => {
    expect(undoLastChain(game(14))).toBeNull();
  });
});

/** Two touching equal tiles, found by scanning the grid. */
function findPair(grid: Grid): { row: number; col: number }[] {
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

