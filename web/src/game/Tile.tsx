import { useEffect, useRef } from "react";
import type { Pos } from "../engine";
import { useShake } from "../feel/useShake";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { tileColours } from "./colours";
import { formatValue } from "./format";
import { cellOffset } from "./layout";

const SPAWN_MS = 520;
const POP_MS = 360;
/** Overshoots and settles, for the bouncy fall and the pop. */
const BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export interface TileProps {
  pos: Pos;
  /** Value shown. For the chain's tip while dragging, this is the preview of the merge. */
  value: number;
  /** The tile is part of the chain being dragged. */
  selected: boolean;
  /** The tile is the chain's tip, showing the live merge preview. */
  preview: boolean;
  /** Changes when this tile is merged. Each change replays the pop. 0 means never. */
  pop: number;
  /** Changes when this tile spawns. Each change replays the fall-in from `fromRow`. 0 means never. */
  spawnStamp: number;
  fromRow: number;
  /** Changes when a drag is rejected on this tile. Each change replays the shake. 0 means never. */
  reject: number;
}

/**
 * One tile. The outer element is placed by transform, so a move from one cell to another is a CSS
 * transition, and the face takes the pop, shake and glow. Under reduced motion, transitions are
 * off in CSS and the Web Animations calls are skipped here.
 */
export function Tile({ pos, value, selected, preview, pop, spawnStamp, fromRow, reject }: TileProps) {
  const outer = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const shake = useShake(face, { amplitude: 3, duration: 320 });
  const { x, y } = cellOffset(pos);
  const colours = tileColours(value);
  const label = formatValue(value);

  useEffect(() => {
    const el = face.current;
    if (!pop || !el || prefersReducedMotion() || typeof el.animate !== "function") return;
    el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: 0.4 }, { transform: "scale(1)" }],
      { duration: POP_MS, easing: BOUNCE },
    );
  }, [pop]);

  useEffect(() => {
    const el = outer.current;
    if (!spawnStamp || !el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const from = cellOffset({ row: fromRow, col: pos.col });
    el.animate(
      [
        { transform: `translate(${from.x}cqw, ${from.y}cqw)` },
        { transform: `translate(${x}cqw, ${y}cqw)` },
      ],
      { duration: SPAWN_MS, easing: BOUNCE },
    );
    // Only a new spawn should replay the fall, so position changes are left to the CSS transition.
  }, [spawnStamp]);

  useEffect(() => {
    if (reject) shake();
  }, [reject, shake]);

  const classes = ["tile-face"];
  if (selected) classes.push("selected");
  if (preview) classes.push("preview");
  if (label.length >= 4) classes.push("long");

  return (
    <div
      ref={outer}
      className="tile"
      data-testid="board-tile"
      data-row={pos.row}
      data-col={pos.col}
      style={{ transform: `translate(${x}cqw, ${y}cqw)` }}
    >
      <div
        ref={face}
        className={classes.join(" ")}
        style={{ background: colours.background, color: colours.text }}
        data-value={value}
      >
        {label}
      </div>
    </div>
  );
}
