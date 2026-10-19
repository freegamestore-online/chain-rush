import { useCallback, useEffect, useReducer, useState } from "react";
import {
  type GameState,
  type HelperKind,
  type Grid,
  type Pos,
  applyGravity,
  commitChain,
  newGame,
  undoLastChain,
  useHammer,
  useShuffle,
  useSwap,
} from "../engine";
import { DAILY_MOVES, dailyGame, utcDate } from "./daily";
import {
  MODES,
  type Mode,
  type SavedFile,
  type SavedGame,
  browserStore,
  readSavedFile,
  writeSavedFile,
} from "./storage";

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
  /** The mode on screen. */
  mode: Mode;
  /** The daily board's date while in daily mode, otherwise null. */
  date: string | null;
  /** The other mode's game, kept while this one is on screen. */
  parked: Partial<Record<Mode, SavedGame>>;
}

export type ChainAction =
  | { type: "commit"; chain: readonly Pos[] }
  | { type: "hammer"; pos: Pos }
  | { type: "swap"; a: Pos; b: Pos }
  | { type: "shuffle" }
  | { type: "undo" }
  | { type: "restart"; seed: number }
  | { type: "switchMode"; mode: Mode; today: string; seed: number }
  | { type: "celebrated" };

/** Ids for every occupied cell of a grid, counting up from 1. */
function idsFor(grid: Grid): { ids: (number | null)[][]; nextId: number } {
  let nextId = 1;
  const ids = grid.map((row) => row.map((tile) => (tile === null ? null : nextId++)));
  return { ids, nextId };
}

/** A new game in `mode`: today's daily board, or a random endless board from `seed`. */
export function freshState(mode: Mode, today: string, seed: number, stamp = 0, parked = {}): ChainState {
  const game = mode === "daily" ? dailyGame(today) : newGame(seed);
  const { ids, nextId } = idsFor(game.grid);
  return {
    game,
    ids,
    undoIds: null,
    nextId,
    stamp,
    merge: null,
    celebrations: [],
    mode,
    date: mode === "daily" ? today : null,
    parked,
  };
}

/** A fresh endless game from `seed`. */
export function startState(seed: number, stamp = 0): ChainState {
  return freshState("endless", "", seed, stamp);
}

/** Resumes a saved game with the view state it had. */
function fromSaved(saved: SavedGame, mode: Mode, stamp: number, parked: ChainState["parked"]): ChainState {
  return {
    game: saved.game,
    ids: saved.ids,
    undoIds: saved.undoIds,
    nextId: saved.nextId,
    stamp,
    merge: null,
    celebrations: [],
    mode,
    date: saved.date,
    parked,
  };
}

export function toSaved(state: ChainState): SavedGame {
  return {
    date: state.date,
    game: state.game,
    ids: state.ids,
    undoIds: state.undoIds,
    nextId: state.nextId,
  };
}

/** The save file for the current state: the active game plus the parked one. */
export function fileFrom(state: ChainState): SavedFile {
  return {
    version: 1,
    active: state.mode,
    slots: { ...state.parked, [state.mode]: toSaved(state) },
  };
}

/** A saved slot is usable only if it still applies: a daily board must be for today's date. */
function usableSlot(file: SavedFile, mode: Mode, today: string): SavedGame | null {
  const saved = file.slots[mode];
  if (!saved) return null;
  if (mode === "daily" && saved.date !== today) return null;
  return saved;
}

/** The state on page load: the saved active game if there is one, otherwise a fresh game. */
export function initialState(file: SavedFile | null, today: string, seed: number): ChainState {
  if (!file) return freshState("endless", today, seed);

  const parked: ChainState["parked"] = {};
  for (const mode of MODES) {
    if (mode === file.active) continue;
    const saved = usableSlot(file, mode, today);
    if (saved) parked[mode] = saved;
  }

  const saved = usableSlot(file, file.active, today);
  if (!saved) return freshState(file.active, today, seed, 0, parked);
  return fromSaved(saved, file.active, 0, parked);
}

/** The daily board has used all of its moves. Undo is locked from here on. */
export function isLimitReached(state: ChainState): boolean {
  return state.mode === "daily" && state.game.moves >= DAILY_MOVES;
}

/** The game has ended: the board has no chain left, or a daily board has used its moves. */
export function isFinished(state: ChainState): boolean {
  return state.game.over || isLimitReached(state);
}

export function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case "commit":
      return isFinished(state) ? state : commit(state, action.chain);
    case "hammer":
      return isFinished(state) ? state : hammer(state, action.pos);
    case "swap":
      return isFinished(state) ? state : swap(state, action.a, action.b);
    case "shuffle":
      return isFinished(state) ? state : shuffle(state);
    case "undo":
      return isLimitReached(state) ? state : undo(state);
    case "restart":
      return restart(state, action.seed);
    case "switchMode":
      return switchMode(state, action.mode, action.today, action.seed);
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
  const nextId = assignIds(ids, result.spawned, state.nextId);

  const stamp = state.stamp + 1;
  return {
    ...state,
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

/**
 * Restart means a new endless game. From daily, it switches to endless, since the daily board is
 * one attempt per date and cannot be replayed.
 */
function restart(state: ChainState, seed: number): ChainState {
  if (state.mode === "daily") return switchMode(state, "endless", "", seed);
  return freshState("endless", "", seed, state.stamp, state.parked);
}

/**
 * Moves to another mode. The current game is parked, and the target's parked game comes back if it
 * still applies: a daily board for today, or an endless game that has not ended. Otherwise the
 * target starts fresh.
 */
function switchMode(state: ChainState, mode: Mode, today: string, seed: number): ChainState {
  if (mode === state.mode) return state;

  const parked: ChainState["parked"] = { ...state.parked, [state.mode]: toSaved(state) };
  const target = parked[mode];
  delete parked[mode];

  const reusable = target !== undefined && (mode === "daily" ? target.date === today : !target.game.over);
  if (target && reusable) return fromSaved(target, mode, state.stamp, parked);
  return freshState(mode, today, seed, state.stamp, parked);
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

/** Optional deterministic seed for browser play-throughs and shareable reproductions. */
function initialSeed(): number {
  if (typeof window === "undefined") return randomSeed();
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null || !/^\d+$/.test(raw)) return randomSeed();
  const seed = Number(raw);
  return Number.isSafeInteger(seed) && seed <= 0xffff_ffff ? seed : randomSeed();
}

export function useChainGame() {
  const [today] = useState(utcDate);
  const [state, dispatch] = useReducer(chainReducer, undefined, () =>
    initialState(readSavedFile(browserStore()), today, initialSeed()),
  );

  useEffect(() => {
    writeSavedFile(browserStore(), fileFrom(state));
  }, [state]);

  const commit = useCallback((chain: readonly Pos[]) => dispatch({ type: "commit", chain: [...chain] }), []);
  const hammerAt = useCallback((pos: Pos) => dispatch({ type: "hammer", pos }), []);
  const swapTiles = useCallback((a: Pos, b: Pos) => dispatch({ type: "swap", a, b }), []);
  const shuffleBoard = useCallback(() => dispatch({ type: "shuffle" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const restart = useCallback(() => dispatch({ type: "restart", seed: randomSeed() }), []);
  const switchMode = useCallback(
    (mode: Mode) => dispatch({ type: "switchMode", mode, today, seed: randomSeed() }),
    [today],
  );
  const celebrated = useCallback(() => dispatch({ type: "celebrated" }), []);

  return {
    ...state,
    today,
    finished: isFinished(state),
    limitReached: isLimitReached(state),
    commit,
    hammerAt,
    swapTiles,
    shuffleBoard,
    undo,
    restart,
    switchMode,
    celebrated,
  };
}
