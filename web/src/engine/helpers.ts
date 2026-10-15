import { hasValidChain } from "./chain";
import { type GameState } from "./game";
import { type Grid, type Pos, cloneGrid, getTile, highestTile, setTile } from "./grid";
import { createRng, type Rng } from "./rng";
import { refill } from "./spawn";

/*
 * Helpers spend one use from their counter. A helper that cannot be used (no uses left, no tile at
 * the target, game over) returns null and leaves the state untouched. None of them score, and none
 * of them starts a new undo snapshot: undo only goes back to before the last chain.
 */

export interface HelperResult {
  state: GameState;
  /** Cells that received new tiles, for hammer. Empty for the other helpers. */
  spawned: Pos[];
}

/** Removes the tile at `pos`, then lets the column settle and refills, so the board stays full. */
export function useHammer(state: GameState, pos: Pos): HelperResult | null {
  if (state.over || state.helpers.hammer <= 0 || getTile(state.grid, pos) === null) return null;

  const cleared = cloneGrid(state.grid);
  setTile(cleared, pos, null);
  const rng = createRng(state.rngState);
  const { grid, spawned } = refill(cleared, rng);
  return {
    state: {
      ...state,
      grid,
      helpers: { ...state.helpers, hammer: state.helpers.hammer - 1 },
      highest: Math.max(state.highest, highestTile(grid)),
      rngState: rng.state(),
      over: !hasValidChain(grid),
    },
    spawned,
  };
}

/** Swaps the values of two different, non-empty tiles. */
export function useSwap(state: GameState, a: Pos, b: Pos): HelperResult | null {
  if (state.over || state.helpers.swap <= 0) return null;
  if (a.row === b.row && a.col === b.col) return null;
  const valueA = getTile(state.grid, a);
  const valueB = getTile(state.grid, b);
  if (valueA === null || valueB === null) return null;

  const grid = cloneGrid(state.grid);
  setTile(grid, a, valueB);
  setTile(grid, b, valueA);
  return {
    state: {
      ...state,
      grid,
      helpers: { ...state.helpers, swap: state.helpers.swap - 1 },
      over: !hasValidChain(grid),
    },
    spawned: [],
  };
}

/**
 * Rearranges every tile into a new random order. Tiles stay in the same cells' set, so empty cells
 * stay empty. Reshuffles, up to a limit, if the result has no chain.
 */
export function useShuffle(state: GameState): HelperResult | null {
  if (state.over || state.helpers.shuffle <= 0) return null;

  const rng = createRng(state.rngState);
  const positions: Pos[] = [];
  const values: number[] = [];
  state.grid.forEach((cells, row) =>
    cells.forEach((tile, col) => {
      if (tile !== null) {
        positions.push({ row, col });
        values.push(tile);
      }
    }),
  );

  let grid: Grid = state.grid;
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const shuffled = shuffleValues(values, rng);
    grid = cloneGrid(state.grid);
    positions.forEach((pos, i) => setTile(grid, pos, shuffled[i] ?? null));
    if (hasValidChain(grid)) break;
  }

  return {
    state: {
      ...state,
      grid,
      helpers: { ...state.helpers, shuffle: state.helpers.shuffle - 1 },
      rngState: rng.state(),
      over: !hasValidChain(grid),
    },
    spawned: [],
  };
}

const MAX_SHUFFLE_ATTEMPTS = 50;

/** Fisher–Yates on a copy, drawing from the seeded RNG so a game replays the same way. */
function shuffleValues(values: readonly number[], rng: Rng): number[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}
