import { useCallback, useReducer } from "react";
import {
  type GameState,
  type HelperKind,
  type Pos,
  applyGravity,
  commitChain,
  newGame,
  undoLastChain,
  useHammer,
  useShuffle,
  useSwap,
} from "../engine";

/** What the last chain did, for the view's merge pop, particles, and score pop. */
export interface MergeEvent {
  /** Increases with every chain in the session, so an effect can tell a new merge from a re-render. */
  stamp: number;
  /** Cell of the merged tile before gravity. */
  at: Pos;
  /** Id of the merged tile, which survives the merge with the new value. */
  tileId: number | null;
  value: number;
  points: number;
  /** Cells that received new tiles this turn. */
  spawned: Pos[];
  /** Helpers this chain earned. */
  earned: HelperKind[];
}

export interface ChainState {
  game: GameState;
  /**
   * A tile id for every occupied cell, parallel to `game.grid`. Gravity, spawns, and helpers move
   * ids the same way they move values, so the view can animate each tile from where it was.
   */
  ids: (number | null)[][];
  /** Ids from before the last chain, restored with the engine's undo. */
  undoIds: (number | null)[][] | null;
  nextId: number;
  stamp: number;
  merge: MergeEvent | null;
  /** Milestones reached and not yet celebrated, oldest first. */
  celebrations: number[];
}

export type ChainAction =
  | { type: "commit"; chain: readonly Pos[] }
  | { type: "hammer"; pos: Pos }
  | { type: "swap"; a: Pos; b: Pos }
  | { type: "shuffle" }
  | { type: "undo" }
  | { type: "restart"; seed: number }
  | { type: "celebrated" };

/** A fresh game from `seed`, with ids for every tile on the opening board. */
export function startState(seed: number, stamp = 0): ChainState {
  const game = newGame(seed);
  let nextId = 1;
  const ids = game.grid.map((row) => row.map((tile) => (tile === null ? null : nextId++)));
  return { game, ids, undoIds: null, nextId, stamp, merge: null, celebrations: [] };
}

export function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "commit":
      return commit(state, action.chain);
    case "hammer":
      return hammer(state, action.pos);
    case "swap":
      return swap(state, action.a, action.b);
    case "shuffle":
      return shuffle(state);
    case "undo":
      return undo(state);
    case "restart":
      return startState(action.seed, state.stamp);
    case "celebrated":
      return { ...state, celebrations: state.celebrations.slice(1) };
  }
}

function commit(state: ChainState, chain: readonly Pos[]): ChainState {
  const result = commitChain(state.game, chain);
  const last = chain[chain.length - 1];
  if (!result || !last) return state;

  // Empty the chain's tiles except the last, which keeps its id as the merged tile.
  const cleared = state.ids.map((row) => [...row]);
  for (const pos of chain.slice(0, -1)) {
    const cells = cleared[pos.row];
    if (cells) cells[pos.col] = null;
  }
  const tileId = state.ids[last.row]?.[last.col] ?? null;

  const ids = applyGravity(cleared);
  let nextId = state.nextId;
  nextId = assignIds(ids, result.spawned, nextId);

  const stamp = state.stamp + 1;
  return {
    game: result.state,
    ids,
    undoIds: state.ids,
    nextId,
    stamp,
    merge: {
      stamp,
      at: last,
      tileId,
      value: result.value,
      points: result.scoreDelta,
      spawned: result.spawned,
      earned: result.earned,
    },
    celebrations: [...state.celebrations, ...result.milestones],
  };
}

function hammer(state: ChainState, pos: Pos): ChainState {
  const result = useHammer(state.game, pos);
  if (!result) return state;

  const cleared = state.ids.map((row) => [...row]);
  const cells = cleared[pos.row];
  if (cells) cells[pos.col] = null;
  const ids = applyGravity(cleared);
  const nextId = assignIds(ids, result.spawned, state.nextId);
  return { ...state, game: result.state, ids, nextId, merge: null };
}

function swap(state: ChainState, a: Pos, b: Pos): ChainState {
  const result = useSwap(state.game, a, b);
  if (!result) return state;

  const ids = state.ids.map((row) => [...row]);
  const idA = ids[a.row]?.[a.col] ?? null;
  const idB = ids[b.row]?.[b.col] ?? null;
  const rowA = ids[a.row];
  const rowB = ids[b.row];
  if (rowA) rowA[a.col] = idB;
  if (rowB) rowB[b.col] = idA;
  return { ...state, game: result.state, ids, merge: null };
}

function shuffle(state: ChainState): ChainState {
  const result = useShuffle(state.game);
  if (!result) return state;

  // A shuffle moves every tile, so each occupied cell gets a fresh id and the tiles appear to jump.
  let nextId = state.nextId;
  const ids = result.state.grid.map((row) => row.map((tile) => (tile === null ? null : nextId++)));
  return { ...state, game: result.state, ids, nextId, merge: null };
}

function undo(state: ChainState): ChainState {
  const game = undoLastChain(state.game);
  if (!game || !state.undoIds) return state;
  return { ...state, game, ids: state.undoIds, undoIds: null, merge: null };
}

/** Gives each spawned cell a new id, in place. Returns the next free id. */
function assignIds(ids: (number | null)[][], spawned: readonly Pos[], nextId: number): number {
  let next = nextId;
  for (const { row, col } of spawned) {
    const cells = ids[row];
    if (cells) cells[col] = next++;
  }
  return next;
}

/** Random seed for a new game. Only called from event handlers and lazy initialisers, never from a reducer. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function useChainGame() {
  const [state, dispatch] = useReducer(chainReducer, undefined, () => startState(randomSeed()));

  const commit = useCallback((chain: readonly Pos[]) => dispatch({ type: "commit", chain: [...chain] }), []);
  const hammerAt = useCallback((pos: Pos) => dispatch({ type: "hammer", pos }), []);
  const swapTiles = useCallback((a: Pos, b: Pos) => dispatch({ type: "swap", a, b }), []);
  const shuffleBoard = useCallback(() => dispatch({ type: "shuffle" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const restart = useCallback(() => dispatch({ type: "restart", seed: randomSeed() }), []);
  const celebrated = useCallback(() => dispatch({ type: "celebrated" }), []);

  return { ...state, commit, hammerAt, swapTiles, shuffleBoard, undo, restart, celebrated };
}
