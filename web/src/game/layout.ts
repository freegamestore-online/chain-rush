import { COLS, ROWS, type Pos } from "../engine";

/*
 * Board geometry in percent of the board's width. Both axes use the same unit, so a board that is
 * 5 cells wide and 8 cells tall is 100 × 160 units. index.css uses the same numbers in cqw.
 */
export const PAD_X = 2;
export const PAD_Y = 2.6;
export const GAP = 2;
export const CELL = 17.6;
/** Distance from one cell's top-left corner to the next. */
export const PITCH = CELL + GAP;
export const BOARD_HEIGHT = 160;

export interface Point {
  x: number;
  y: number;
}

/** Top-left corner of a cell. Negative rows are valid and sit above the board, which is where new tiles enter from. */
export function cellOffset({ row, col }: Pos): Point {
  return { x: PAD_X + col * PITCH, y: PAD_Y + row * PITCH };
}

export function cellCentre(pos: Pos): Point {
  const { x, y } = cellOffset(pos);
  return { x: x + CELL / 2, y: y + CELL / 2 };
}

/**
 * The cell under a point, or null outside the board. Each cell's hit area reaches half a gap into
 * the space around it, so a finger in a gap picks the nearer tile rather than nothing.
 */
export function cellAt({ x, y }: Point): Pos | null {
  const col = Math.floor((x - PAD_X + GAP / 2) / PITCH);
  const row = Math.floor((y - PAD_Y + GAP / 2) / PITCH);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { row, col };
}
