import { hasValidChain } from "./chain";
import { type Grid, type Pos, createGrid, highestTile } from "./grid";
import { mergeChain } from "./merge";
import { createRng } from "./rng";
import { refill } from "./spawn";

export interface GameState {
  grid: Grid;
  score: number;
  /** Largest tile so far. Drives spawn sizes and milestones. */
  highest: number;
  /** RNG state after the last spawn, so the next turn continues the same sequence. */
  rngState: number;
  /** True when no two touching tiles are equal. */
  over: boolean;
}

export interface CommitResult {
  state: GameState;
  /** Last cell of the chain, where the merged tile sat before gravity. */
  mergedAt: Pos;
  value: number;
  scoreDelta: number;
  /** Cells that received new tiles, all in the top rows of their column. */
  spawned: Pos[];
}

/** A full opening board from `seed`. Re-rolls in the unlikely case it has no chain at all. */
export function newGame(seed: number): GameState {
  const rng = createRng(seed);
  let grid: Grid;
  do {
    grid = refill(createGrid(), rng).grid;
  } while (!hasValidChain(grid));
  return { grid, score: 0, highest: highestTile(grid), rngState: rng.state(), over: false };
}

/** Plays one chain: merge, gravity, spawn, then score and game-over check. Null if the chain is not valid. */
export function commitChain(state: GameState, chain: readonly Pos[]): CommitResult | null {
  if (state.over) return null;
  const merged = mergeChain(state.grid, chain);
  const last = chain[chain.length - 1];
  if (!merged || !last) return null;

  const rng = createRng(state.rngState);
  const { grid, spawned } = refill(merged.grid, rng);
  return {
    state: {
      grid,
      score: state.score + merged.scoreDelta,
      highest: Math.max(state.highest, highestTile(grid)),
      rngState: rng.state(),
      over: !hasValidChain(grid),
    },
    mergedAt: last,
    value: merged.value,
    scoreDelta: merged.scoreDelta,
    spawned,
  };
}
