import { describe, expect, it } from "vitest";
import { hasValidChain } from "./chain";
import { type Grid, type Pos, createGrid, getTile, setTile } from "./grid";
import { type GameState, commitChain, newGame } from "./game";
import { createRng } from "./rng";

/** Finds two touching equal tiles, returned as a chain of two. */
function firstPair(grid: Grid): Pos[] {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
      const here = { row, col };
      const tile = getTile(grid, here);
      if (tile === null) continue;
      for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (getTile(grid, next) === tile) return [here, next];
      }
    }
  }
  return [];
}

function stateFrom(grid: Grid, seed = 1): GameState {
  return { grid, score: 0, highest: 4, rngState: createRng(seed).state(), over: false };
}

describe("newGame", () => {
  it("is deterministic under a seed", () => {
    expect(newGame(77)).toEqual(newGame(77));
  });

  it("opens with a full board that has a chain", () => {
    const state = newGame(123);
    expect(state.grid.flat().every((tile) => tile !== null)).toBe(true);
    expect(hasValidChain(state.grid)).toBe(true);
    expect(state.score).toBe(0);
    expect(state.over).toBe(false);
  });
});

describe("commitChain", () => {
  it("merges, refills, and scores a valid chain", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 2);
    setTile(grid, { row: 7, col: 1 }, 2);
    const result = commitChain(stateFrom(grid), [{ row: 7, col: 0 }, { row: 7, col: 1 }]);

    expect(result).not.toBeNull();
    expect(result?.value).toBe(4);
    expect(result?.state.score).toBe(4);
    expect(result?.mergedAt).toEqual({ row: 7, col: 1 });
    expect(result?.state.grid.flat().every((tile) => tile !== null)).toBe(true);
  });

  it("reports one spawned cell per cleared cell", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 2);
    setTile(grid, { row: 7, col: 1 }, 2);
    const result = commitChain(stateFrom(grid), [{ row: 7, col: 0 }, { row: 7, col: 1 }]);
    // Two tiles were on the board and the chain left one. The other 39 cells are spawned.
    expect(result?.spawned).toHaveLength(39);
  });

  it("returns null for an invalid chain and leaves the state alone", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 2);
    setTile(grid, { row: 7, col: 1 }, 4);
    expect(commitChain(stateFrom(grid), [{ row: 7, col: 0 }, { row: 7, col: 1 }])).toBeNull();
  });

  it("refuses to play once the game is over", () => {
    const state = { ...stateFrom(createGrid()), over: true };
    expect(commitChain(state, [{ row: 0, col: 0 }, { row: 0, col: 1 }])).toBeNull();
  });

  it("continues the RNG sequence, so the next turn differs from a fresh seed", () => {
    const game = newGame(9);
    const result = commitChain(game, firstPair(game.grid));
    expect(result?.state.rngState).not.toBe(game.rngState);
    expect(result?.state.over).toBe(!hasValidChain(result?.state.grid ?? createGrid()));
  });
});

