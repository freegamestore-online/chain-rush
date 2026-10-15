import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Grid, createGrid, setTile } from "../engine";
import GameShell from "../GameShell";
import { Board } from "./Board";
import { cellCentre } from "./layout";

/** Board of 2s, 2s, 8 across the top row, so a drag of 2-2 is fine and a third 8 is rejected. */
function gridWith(rows: number[][]): Grid {
  const grid = createGrid();
  rows.forEach((values, row) => values.forEach((value, col) => setTile(grid, { row, col }, value || null)));
  return grid;
}

/** Ids are not used by the drag itself, so every occupied cell gets one. */
function idsFor(grid: Grid): (number | null)[][] {
  let next = 1;
  return grid.map((row) => row.map((tile) => (tile === null ? null : next++)));
}

/** Screen position of a cell's centre, for a board 100px wide and 160px tall at the origin. */
function pointOf(row: number, col: number): { clientX: number; clientY: number } {
  const c = cellCentre({ row, col });
  return { clientX: c.x, clientY: c.y };
}

function renderBoard(grid: Grid, onCommit = vi.fn()) {
  render(
    <GameShell>
      <Board grid={grid} ids={idsFor(grid)} merge={null} over={false} onCommit={onCommit} />
    </GameShell>,
  );
  const board = screen.getByRole("application", { name: "Chain Rush board" });
  return { board, onCommit };
}

describe("Board drag", () => {
  beforeEach(() => {
    // jsdom has no layout, so give the board a 100px × 160px rectangle at the origin.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 160,
      right: 100,
      bottom: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    // Pointer capture is missing from jsdom, and frames are run inline so each move is applied at once.
    Element.prototype.setPointerCapture = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("commits a chain of two equal tiles dragged across the board", () => {
    const grid = gridWith([
      [2, 2, 8, 0, 0],
      [4, 16, 32, 64, 128],
    ]);
    const { board, onCommit } = renderBoard(grid);

    act(() => {
      fireEvent.pointerDown(board, { pointerId: 1, ...pointOf(0, 0) });
      fireEvent.pointerMove(board, { pointerId: 1, ...pointOf(0, 1) });
      fireEvent.pointerUp(board, { pointerId: 1, ...pointOf(0, 1) });
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  it("shows the merge value on the chain tip while dragging", () => {
    const grid = gridWith([
      [2, 2, 4, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const { board } = renderBoard(grid);

    act(() => {
      fireEvent.pointerDown(board, { pointerId: 1, ...pointOf(0, 0) });
      fireEvent.pointerMove(board, { pointerId: 1, ...pointOf(0, 1) });
    });

    // 2 + 2 = 4 on the tip. The tip's face carries the preview class.
    const tip = document.querySelector(".tile-face.preview");
    expect(tip?.textContent).toBe("4");
  });

  it("rejects a step that would break the chain and keeps the chain as it was", () => {
    const grid = gridWith([
      [2, 2, 8, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const { board, onCommit } = renderBoard(grid);

    act(() => {
      fireEvent.pointerDown(board, { pointerId: 1, ...pointOf(0, 0) });
      fireEvent.pointerMove(board, { pointerId: 1, ...pointOf(0, 1) });
      fireEvent.pointerMove(board, { pointerId: 1, ...pointOf(0, 2) });
      fireEvent.pointerUp(board, { pointerId: 1, ...pointOf(0, 2) });
    });

    // The 8 is rejected, so the release commits the 2-2 pair, not a three-tile chain.
    expect(onCommit.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("shows every tile value as text, so colour is never the only cue", () => {
    const grid = gridWith([
      [2, 1024, 512, 4, 8],
      [16, 32, 64, 128, 256],
    ]);
    renderBoard(grid);
    expect(screen.getByText("1K")).toBeTruthy();
    expect(screen.getByText("512")).toBeTruthy();
    expect(screen.getByText("256")).toBeTruthy();
  });
});
