import { describe, expect, it } from "vitest";
import { type Grid, type Pos, createGrid, getTile, hasValidChain, setTile } from "../engine";
import { spawnFromRows } from "./Board";
import { type ChainState, chainReducer, startState } from "./useChainGame";

/** Every occupied cell has an id and every empty cell has none. */
function idsMatchGrid(state: ChainState): boolean {
  return state.game.grid.every((row, r) =>
    row.every((tile, c) => (tile === null) === ((state.ids[r]?.[c] ?? null) === null)),
  );
}

/** A chain of two equal tiles, found by scanning the board. */
function anyPair(grid: Grid): Pos[] {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
      const here = { row, col };
      const right = { row, col: col + 1 };
      const below = { row: row + 1, col };
      if (getTile(grid, here) !== null && getTile(grid, here) === getTile(grid, right)) return [here, right];
      if (getTile(grid, here) !== null && getTile(grid, here) === getTile(grid, below)) return [here, below];
    }
  }
  return [];
}

describe("helpers and undo in the view", () => {
  it("keeps the id grid matching the board through helpers and undo", () => {
    let state = startState(17, 0);
    state = { ...state, game: { ...state.game, helpers: { hammer: 3, swap: 3, shuffle: 3 } } };
    const pair = anyPair(state.game.grid);
    state = chainReducer(state, { type: "commit", chain: pair });
    expect(idsMatchGrid(state)).toBe(true);

    state = chainReducer(state, { type: "hammer", pos: { row: 7, col: 0 } });
    expect(idsMatchGrid(state)).toBe(true);

    const a = { row: 0, col: 0 };
    const b = { row: 0, col: 1 };
    state = chainReducer(state, { type: "swap", a, b });
    expect(idsMatchGrid(state)).toBe(true);

    state = chainReducer(state, { type: "shuffle" });
    expect(idsMatchGrid(state)).toBe(true);

    state = chainReducer(state, { type: "undo" });
    expect(idsMatchGrid(state)).toBe(true);
  });

  it("restores the ids from before the last chain on undo", () => {
    const start = startState(23);
    const pair = anyPair(start.game.grid);
    const played = chainReducer(start, { type: "commit", chain: pair });
    const restored = chainReducer(played, { type: "undo" });
    expect(restored.ids).toEqual(start.ids);
    expect(restored.game.grid).toEqual(start.game.grid);
  });

  it("does nothing when undo has nothing to restore", () => {
    const state = startState(24);
    expect(chainReducer(state, { type: "undo" })).toBe(state);
  });

  it("does nothing when a helper has no uses left", () => {
    const state = startState(25);
    const empty = { ...state, game: { ...state.game, helpers: { hammer: 0, swap: 0, shuffle: 0 } } };
    expect(chainReducer(empty, { type: "hammer", pos: { row: 0, col: 0 } })).toBe(empty);
    expect(chainReducer(empty, { type: "shuffle" })).toBe(empty);
  });
});

describe("startState", () => {
  it("gives every opening tile a unique id", () => {
    const state = startState(5);
    const ids = state.ids.flat().filter((id): id is number => id !== null);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect(idsMatchGrid(state)).toBe(true);
  });
});

describe("chainReducer", () => {
  it("keeps the id grid in step with the value grid across many turns", () => {
    let state = startState(31);
    for (let turn = 0; turn < 60 && !state.game.over; turn++) {
      const chain = anyPair(state.game.grid);
      if (chain.length === 0) break;
      state = chainReducer(state, { type: "commit", chain });
      expect(idsMatchGrid(state)).toBe(true);
    }
  });

  it("keeps the merged tile's id on its new value, and clears the rest of the chain", () => {
    const state = startState(31);
    const chain = anyPair(state.game.grid);
    const [first, last] = [chain[0]!, chain[1]!];
    const survivorId = state.ids[last.row]?.[last.col];
    const next = chainReducer(state, { type: "commit", chain });

    expect(next.merge?.tileId).toBe(survivorId);
    expect(next.merge?.at).toEqual(last);
    expect(next.stamp).toBe(state.stamp + 1);
    // The first tile's id is gone from the board.
    const liveIds = next.ids.flat();
    expect(liveIds.includes(state.ids[first.row]?.[first.col] ?? null)).toBe(false);
  });

  it("starts a celebration when a new milestone becomes the highest tile", () => {
    const grid = createGrid();
    setTile(grid, { row: 7, col: 0 }, 256);
    setTile(grid, { row: 7, col: 1 }, 256);
    setTile(grid, { row: 6, col: 0 }, 2);
    const base = startState(1);
    const state: ChainState = {
      ...base,
      game: { ...base.game, grid, highest: 256, over: false },
      ids: grid.map((row) => row.map((tile) => (tile === null ? null : 1 + tile))),
      nextId: 1000,
    };
    const next = chainReducer(state, {
      type: "commit",
      chain: [
        { row: 7, col: 0 },
        { row: 7, col: 1 },
      ],
    });
    expect(next.game.highest).toBe(512);
    expect(next.celebrations).toEqual([512]);
    expect(chainReducer(next, { type: "celebrated" }).celebrations).toEqual([]);
  });

  it("keeps the merge stamp counting across a restart, so new merges still get their effects", () => {
    const played = { ...startState(2), stamp: 7 };
    const restarted = chainReducer(played, { type: "restart", seed: 3 });
    expect(restarted.stamp).toBe(7);
    expect(restarted.merge).toBeNull();
  });

  it("ignores a commit that is not a valid chain", () => {
    const state = startState(4);
    const next = chainReducer(state, {
      type: "commit",
      chain: [{ row: 0, col: 0 }],
    });
    expect(next).toBe(state);
  });

  it("the opening board still has a chain", () => {
    expect(hasValidChain(startState(8).game.grid)).toBe(true);
  });
});

describe("spawnFromRows", () => {
  it("places each spawn above the board, stacked so the lowest one falls furthest", () => {
    const merge = {
      stamp: 1,
      at: { row: 0, col: 0 },
      tileId: 1,
      value: 4,
      points: 4,
      spawned: [
        { row: 0, col: 2 },
        { row: 1, col: 2 },
        { row: 0, col: 3 },
      ],
      earned: [],
    };
    const offsets = spawnFromRows(merge);
    expect(offsets.get("0,2")).toBe(-2);
    expect(offsets.get("1,2")).toBe(-1);
    expect(offsets.get("0,3")).toBe(-1);
  });
});
