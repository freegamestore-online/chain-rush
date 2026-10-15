import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "../engine";
import { CELL, GAP, PITCH, cellAt, cellCentre, cellOffset } from "./layout";

describe("board layout", () => {
  it("maps the centre of every cell back to that cell", () => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        expect(cellAt(cellCentre({ row, col }))).toEqual({ row, col });
      }
    }
  });

  it("splits the gap between two cells at its midpoint", () => {
    const y = cellCentre({ row: 0, col: 0 }).y;
    const midpoint = cellOffset({ row: 0, col: 1 }).x - GAP / 2;
    expect(cellAt({ x: midpoint - 0.1, y })).toEqual({ row: 0, col: 0 });
    expect(cellAt({ x: midpoint + 0.1, y })).toEqual({ row: 0, col: 1 });
  });

  it("returns null outside the board", () => {
    expect(cellAt({ x: -5, y: 10 })).toBeNull();
    expect(cellAt({ x: 50, y: 500 })).toBeNull();
    expect(cellAt({ x: 100 + PITCH, y: 10 })).toBeNull();
  });

  it("fits the grid inside the 100 × 160 board, with the cell size and pitch from the constants", () => {
    const last = cellOffset({ row: ROWS - 1, col: COLS - 1 });
    expect(last.x + CELL).toBeLessThan(100);
    expect(last.y + CELL).toBeLessThan(160);
  });
});
