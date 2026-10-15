import { hasValidChain } from "./chain";
import { type Grid, type Pos, cloneGrid, createGrid, highestTile } from "./grid";
import { mergeChain } from "./merge";
import { type HelperCounts, HELPER_KINDS, type HelperKind, STARTING_HELPERS, helpersEarned, milestonesCrossed } from "./progress";
import { createRng, type Rng } from "./rng";
import { refill } from "./spawn";

/** Everything an undo needs to put the board back the way it was before a chain. */
export interface Snapshot {
  grid: Grid;
  score: number;
  highest: number;
  helpers: HelperCounts;
  /** RNG state, so replaying the undone chain spawns the same tiles. */
  rngState: number;
  /** Chains played so far. Helpers do not count. Undo takes a move back. */
  moves: number;
}

export interface GameState extends Snapshot {
  /** True when no two touching tiles are equal. */
  over: boolean;
  /** The state before the last chain, or null once undone or before any chain. */
  undo: Snapshot | null;
  /** Highest milestone celebrated so far. Kept across undo, so a milestone never fires twice. */
  celebrated: number;
}

export interface CommitResult {
  state: GameState;
  /** Last cell of the chain, where the merged tile sat before gravity. */
  mergedAt: Pos;
  value: number;
  scoreDelta: number;
  /** Cells that received new tiles, all in the top rows of their column. */
  spawned: Pos[];
  /** Milestones reached by this chain, lowest first. */
  milestones: number[];
  /** Helpers earned by this chain, one entry per helper. */
  earned: HelperKind[];
}

export function snapshot(state: Snapshot): Snapshot {
  return {
    grid: cloneGrid(state.grid),
    score: state.score,
    highest: state.highest,
    helpers: { ...state.helpers },
    rngState: state.rngState,
    moves: state.moves,
  };
}

/** A fresh game from `seed`: a full opening board and the starting helpers. */
export function newGame(seed: number): GameState {
  const rng = createRng(seed);
  let grid: Grid;
  do {
    grid = refill(createGrid(), rng).grid;
  } while (!hasValidChain(grid));
  return {
    grid,
    score: 0,
    highest: highestTile(grid),
    helpers: { ...STARTING_HELPERS },
    rngState: rng.state(),
    moves: 0,
    over: false,
    undo: null,
    celebrated: 0,
  };
}

/**
 * Plays one chain: merge, gravity, spawn, then score, milestones, and helpers. Null if the chain is
 * not valid or the game is over. The state before the chain becomes the undo snapshot.
 */
export function commitChain(state: GameState, chain: readonly Pos[]): CommitResult | null {
  if (state.over) return null;
  const merged = mergeChain(state.grid, chain);
  const last = chain[chain.length - 1];
  if (!merged || !last) return null;

  const rng = createRng(state.rngState);
  const { grid, spawned } = refill(merged.grid, rng);
  const score = state.score + merged.scoreDelta;
  const earned = drawHelpers(rng, helpersEarned(state.score, score));
  const helpers = { ...state.helpers };
  for (const kind of earned) helpers[kind]++;

  const highest = Math.max(state.highest, highestTile(grid));
  const milestones = milestonesCrossed(state.celebrated, highest);

  return {
    state: {
      grid,
      score,
      highest,
      helpers,
      rngState: rng.state(),
      moves: state.moves + 1,
      over: !hasValidChain(grid),
      undo: snapshot(state),
      celebrated: milestones[milestones.length - 1] ?? state.celebrated,
    },
    mergedAt: last,
    value: merged.value,
    scoreDelta: merged.scoreDelta,
    spawned,
    milestones,
    earned,
  };
}

/** Restores the state from before the last chain. Null when there is nothing to undo. */
export function undoLastChain(state: GameState): GameState | null {
  const before = state.undo;
  if (!before) return null;
  return {
    ...snapshot(before),
    over: !hasValidChain(before.grid),
    undo: null,
    celebrated: state.celebrated,
  };
}

function drawHelpers(rng: Rng, count: number): HelperKind[] {
  return Array.from({ length: count }, () => HELPER_KINDS[rng.nextInt(HELPER_KINDS.length)] ?? "hammer");
}
