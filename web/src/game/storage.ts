import {
  COLS,
  HELPER_KINDS,
  ROWS,
  isPowerOfTwo,
  type GameState,
  type Grid,
  type HelperCounts,
  type Snapshot,
  type Tile,
} from "../engine";
import { isDateString } from "./daily";

/** The one localStorage key holding the saved games. */
export const STATE_KEY = "chain-rush-state";

export const MODES = ["endless", "rush", "daily"] as const;
export type Mode = (typeof MODES)[number];
export const RUSH_DURATION_MS = 60_000;

/** One game as saved: the engine state plus the view's tile ids. Transient animation state is not saved. */
export interface SavedGame {
  /** Daily board date, or null for endless. */
  date: string | null;
  game: GameState;
  ids: (number | null)[][];
  undoIds: (number | null)[][] | null;
  nextId: number;
  /** Remaining clock time for Rush, null for untimed modes. */
  remainingMs: number | null;
}

/** The whole save: which mode is on screen, and a saved game for each mode that has one. */
export interface SavedFile {
  version: 1;
  active: Mode;
  slots: Partial<Record<Mode, SavedGame>>;
}

/** The part of localStorage this module uses. Passed in so tests can supply a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const FILE_VERSION = 1;
const MAX_RNG_STATE = 2 ** 32 - 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown, min = 0): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min;

function parseGrid(value: unknown): Grid | null {
  if (!Array.isArray(value) || value.length !== ROWS) return null;
  const grid: Grid = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== COLS) return null;
    const ok = row.every((tile) => tile === null || (isCount(tile, 2) && isPowerOfTwo(tile)));
    if (!ok) return null;
    grid.push([...row] as Tile[]);
  }
  return grid;
}

function parseIds(value: unknown): (number | null)[][] | null {
  if (!Array.isArray(value) || value.length !== ROWS) return null;
  const ids: (number | null)[][] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== COLS) return null;
    if (!row.every((id) => id === null || isCount(id, 1))) return null;
    ids.push([...row] as (number | null)[]);
  }
  return ids;
}

/** Ids must be present exactly where the board has a tile. */
function idsMatch(ids: (number | null)[][], grid: Grid): boolean {
  return grid.every((row, r) => row.every((tile, c) => (tile === null) === ((ids[r]?.[c] ?? null) === null)));
}

function parseHelpers(value: unknown): HelperCounts | null {
  if (!isRecord(value)) return null;
  const counts: Partial<HelperCounts> = {};
  for (const kind of HELPER_KINDS) {
    const count = value[kind];
    if (!isCount(count)) return null;
    counts[kind] = count;
  }
  return counts as HelperCounts;
}

function parseSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value)) return null;
  const grid = parseGrid(value.grid);
  const helpers = parseHelpers(value.helpers);
  if (!grid || !helpers) return null;
  if (!isCount(value.score) || !isCount(value.highest) || !isCount(value.moves)) return null;
  if (!isCount(value.rngState) || value.rngState > MAX_RNG_STATE) return null;
  return {
    grid,
    score: value.score,
    highest: value.highest,
    helpers,
    rngState: value.rngState,
    moves: value.moves,
  };
}

function parseGame(value: unknown): GameState | null {
  if (!isRecord(value)) return null;
  const snapshot = parseSnapshot(value);
  if (!snapshot || typeof value.over !== "boolean" || !isCount(value.celebrated)) return null;
  let undo: Snapshot | null = null;
  if (value.undo !== null) {
    undo = parseSnapshot(value.undo);
    if (!undo) return null;
  }
  return { ...snapshot, over: value.over, undo, celebrated: value.celebrated };
}

function parseSavedGame(value: unknown): SavedGame | null {
  if (!isRecord(value)) return null;
  if (value.date !== null && !isDateString(value.date)) return null;
  const game = parseGame(value.game);
  if (!game) return null;
  const ids = parseIds(value.ids);
  if (!ids || !idsMatch(ids, game.grid) || !isCount(value.nextId, 1)) return null;

  let undoIds: (number | null)[][] | null = null;
  if (value.undoIds !== null) {
    undoIds = parseIds(value.undoIds);
    if (!undoIds || !game.undo || !idsMatch(undoIds, game.undo.grid)) return null;
  }
  const remainingMs = value.remainingMs === undefined ? null : value.remainingMs;
  if (remainingMs !== null && (!isCount(remainingMs) || remainingMs > RUSH_DURATION_MS)) return null;
  return { date: value.date, game, ids, undoIds, nextId: value.nextId, remainingMs };
}

function validateFile(value: unknown): SavedFile | null {
  if (!isRecord(value) || value.version !== FILE_VERSION) return null;
  if (typeof value.active !== "string" || !(MODES as readonly string[]).includes(value.active)) return null;
  if (!isRecord(value.slots)) return null;

  const slots: Partial<Record<Mode, SavedGame>> = {};
  for (const mode of MODES) {
    const raw = value.slots[mode];
    if (raw === undefined) continue;
    const saved = parseSavedGame(raw);
    if (!saved) return null;
    // Endless has no date and a daily board always has one, so a mismatch means the save is damaged.
    if ((mode === "daily") !== (saved.date !== null) || (mode === "rush") !== (saved.remainingMs !== null)) return null;
    slots[mode] = saved;
  }
  return { version: FILE_VERSION, active: value.active as Mode, slots };
}

/** Parses a saved file. Returns null for a missing, corrupt, or wrong-shaped save. Never throws. */
export function parseSavedFile(raw: string | null): SavedFile | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return validateFile(value);
}

export function serializeSavedFile(file: SavedFile): string {
  return JSON.stringify(file);
}

/** Reads the save from storage. A missing store, a blocked store, or bad data all give null. */
export function readSavedFile(store: KeyValueStore | null): SavedFile | null {
  try {
    return parseSavedFile(store?.getItem(STATE_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Writes the save. If storage is full or blocked the game carries on unsaved. */
export function writeSavedFile(store: KeyValueStore | null, file: SavedFile): void {
  try {
    store?.setItem(STATE_KEY, serializeSavedFile(file));
  } catch {
    // Private browsing or a full quota: play on without saving.
  }
}

/** The page's localStorage, or null where it is unavailable (for example, blocked by the browser). */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
