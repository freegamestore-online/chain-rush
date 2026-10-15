import { chainSum, isValidChain } from "./chain";
import { type Grid, type Pos, cloneGrid, nextPowerOfTwoAtLeast, setTile } from "./grid";

export interface MergeResult {
  /** Board after the merge, before gravity and spawning. */
  grid: Grid;
  /** Value of the tile left on the last cell of the chain. */
  value: number;
  /** Points for this merge. Currently the merged tile's value. */
  scoreDelta: number;
}

/**
 * Releases a valid chain. Every tile except the last is cleared, and the last tile becomes the
 * next power of two at or above the chain's sum. Returns null, leaving the input untouched, when
 * the chain is not valid.
 */
export function mergeChain(grid: Grid, chain: readonly Pos[]): MergeResult | null {
  if (!isValidChain(grid, chain)) return null;
  const last = chain[chain.length - 1];
  if (!last) return null;

  const value = nextPowerOfTwoAtLeast(chainSum(grid, chain));
  const next = cloneGrid(grid);
  for (const pos of chain) setTile(next, pos, null);
  setTile(next, last, value);

  return { grid: next, value, scoreDelta: value };
}
