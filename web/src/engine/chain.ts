import { COLS, ROWS, type Grid, type Pos, getTile, isAdjacent } from "./grid";

export const MIN_CHAIN_LENGTH = 2;

const posKey = ({ row, col }: Pos): string => `${row},${col}`;

/**
 * A chain is an ordered path of distinct, adjacent (diagonals included), non-empty tiles where
 * either every tile has the same value, or the first two tiles are an equal pair and each later
 * tile is double the one before it (2-2-4-8).
 */
export function isValidChain(grid: Grid, chain: readonly Pos[]): boolean {
  if (chain.length < MIN_CHAIN_LENGTH) return false;
  if (new Set(chain.map(posKey)).size !== chain.length) return false;

  const values: number[] = [];
  for (const pos of chain) {
    const tile = getTile(grid, pos);
    if (tile === null) return false;
    values.push(tile);
  }

  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1];
    const cur = chain[i];
    if (!prev || !cur || !isAdjacent(prev, cur)) return false;
  }

  if (values.every((value) => value === values[0])) return true;

  if (values[0] !== values[1]) return false;
  for (let i = 2; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev === undefined || values[i] !== prev * 2) return false;
  }
  return true;
}

export function chainSum(grid: Grid, chain: readonly Pos[]): number {
  return chain.reduce((sum, pos) => sum + (getTile(grid, pos) ?? 0), 0);
}

/**
 * True when at least one valid chain exists. Every valid chain starts with an equal adjacent
 * pair, and an equal adjacent pair is itself a valid chain of length 2. So a board has a valid
 * chain exactly when two equal non-empty tiles touch.
 */
export function hasValidChain(grid: Grid): boolean {
  // Forward half of the 8 neighbours is enough: each pair is visited once from its earlier cell.
  const offsets = [
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ] as const;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tile = getTile(grid, { row, col });
      if (tile === null) continue;
      for (const [dRow, dCol] of offsets) {
        if (getTile(grid, { row: row + dRow, col: col + dCol }) === tile) return true;
      }
    }
  }
  return false;
}

export type ExtendStatus = "added" | "removed" | "rejected" | "unchanged";

export interface ExtendResult {
  /** The chain after the drag step. Same reference as the input when nothing changed. */
  chain: readonly Pos[];
  status: ExtendStatus;
}

/**
 * One step of a drag. Starts a chain on a tile, adds an adjacent tile if the chain stays valid,
 * removes the last tile when the drag steps back onto it, and rejects a step that would break the
 * chain. Steps onto empty cells, the current tile, or non-adjacent cells are ignored.
 */
export function extendChain(grid: Grid, chain: readonly Pos[], pos: Pos): ExtendResult {
  if (getTile(grid, pos) === null) return { chain, status: "unchanged" };

  const last = chain[chain.length - 1];
  if (!last) return { chain: [pos], status: "added" };
  if (samePos(pos, last)) return { chain, status: "unchanged" };

  const previous = chain[chain.length - 2];
  if (previous && samePos(pos, previous)) return { chain: chain.slice(0, -1), status: "removed" };

  if (!isAdjacent(last, pos) || chain.some((p) => samePos(p, pos))) return { chain, status: "unchanged" };

  const candidate = [...chain, pos];
  return isValidChain(grid, candidate)
    ? { chain: candidate, status: "added" }
    : { chain, status: "rejected" };
}

function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}
