import { useCallback, useReducer } from "react";
import { type GameState, type Pos, applyGravity, commitChain, newGame } from "../engine";
import { isMilestone } from "./format";

/** What the last turn did, for the view's merge pop, particles, and score pop. */
export interface MergeEvent {
  /** Increases with every merge in the session, so an effect can tell a new merge from a re-render. */
  stamp: number;
  /** Cell of the merged tile before gravity. */
  at: Pos;
  /** Id of the merged tile, which survives the merge with the new value. */
  tileId: number | null;
  value: number;
  points: number;
  /** Cells that received new tiles this turn. */
  spawned: Pos[];
}

export interface ChainState {
  game: GameState;
  /**
   * A tile id for every occupied cell, parallel to `game.grid`. Gravity and spawns move ids the same
   * way they move values, so the view can animate each tile from where it was to where it is now.
   */
  ids: (number | null)[][];
  nextId: number;
  stamp: number;
  merge: MergeEvent | null;
  /** Milestone value waiting to be celebrated, or null. */
  celebrate: number | null;
}

export type ChainAction =
  | { type: "commit"; chain: readonly Pos[] }
  | { type: "restart"; seed: number }
  | { type: "celebrated" };

/** A fresh game from `seed`, with ids for every tile on the opening board. */
export function startState(seed: number, stamp = 0): ChainState {
  const game = newGame(seed);
  let nextId = 1;
  const ids = game.grid.map((row) => row.map((tile) => (tile === null ? null : nextId++)));
  return { game, ids, nextId, stamp, merge: null, celebrate: null };
}

export function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "commit":
      return commit(state, action.chain);
    case "restart":
      return startState(action.seed, state.stamp);
    case "celebrated":
      return { ...state, celebrate: null };
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
  for (const { row, col } of result.spawned) {
    const cells = ids[row];
    if (cells) cells[col] = nextId++;
  }

  const stamp = state.stamp + 1;
  const newHighest = result.state.highest > state.game.highest ? result.state.highest : null;
  const milestone = newHighest !== null && isMilestone(newHighest) ? newHighest : null;

  return {
    game: result.state,
    ids,
    nextId,
    stamp,
    merge: {
      stamp,
      at: last,
      tileId,
      value: result.value,
      points: result.scoreDelta,
      spawned: result.spawned,
    },
    celebrate: milestone ?? state.celebrate,
  };
}

/** Random seed for a new game. Only called from event handlers and lazy initialisers, never from a reducer. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function useChainGame() {
  const [state, dispatch] = useReducer(chainReducer, undefined, () => startState(randomSeed()));

  const commit = useCallback((chain: readonly Pos[]) => dispatch({ type: "commit", chain: [...chain] }), []);
  const restart = useCallback(() => dispatch({ type: "restart", seed: randomSeed() }), []);
  const celebrated = useCallback(() => dispatch({ type: "celebrated" }), []);

  return { ...state, commit, restart, celebrated };
}
