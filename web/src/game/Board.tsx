import {
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGameSounds, useSound } from "@freegamestore/games";
import {
  COLS,
  ROWS,
  chainSum,
  extendChain,
  getTile,
  nextPowerOfTwoAtLeast,
  type Grid,
  type Pos,
} from "../engine";
import { HAPTICS, ParticleLayer, ScorePop, useHaptics, type ParticleLayerHandle } from "../feel";
import { tileColours } from "./colours";
import { cellAt, cellCentre, cellOffset, BOARD_HEIGHT, type Point } from "./layout";
import { playLinkTone, playRejectTone, primeAudio } from "./audio";
import type { MergeEvent } from "./useChainGame";
import { Tile } from "./Tile";

export type BoardMode = "chain" | "hammer" | "swap";

export interface BoardProps {
  grid: Grid;
  ids: (number | null)[][];
  merge: MergeEvent | null;
  over: boolean;
  onCommit: (chain: readonly Pos[]) => void;
  /** `chain` drags to merge. The helper modes turn each tap into `onTap` instead. */
  mode?: BoardMode;
  /** A tile already picked in swap mode, shown as selected. */
  pending?: Pos | null;
  onTap?: (pos: Pos) => void;
}

interface Drag {
  pointerId: number;
  chain: Pos[];
  /** Latest pointer position, applied once per frame. */
  pending: Point | null;
  frame: number;
  /** Cell last processed, so a finger that stays on one cell does no work. */
  lastKey: string | null;
}

interface Rejection {
  pos: Pos;
  stamp: number;
}

interface ScorePopState {
  id: number;
  points: number;
  x: number;
  y: number;
}

const cellKey = ({ row, col }: Pos): string => `${row},${col}`;

/**
 * The 5×8 board: drag across touching tiles to build a chain, see the merge value on the tip, and
 * release to merge. Pointer moves are coalesced to one update per frame, and React only re-renders
 * when the chain itself changes.
 */
export function Board({ grid, ids, merge, over, onCommit, mode = "chain", pending = null, onTap }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleLayerHandle>(null);
  const gridRef = useRef(grid);
  const mutedRef = useRef(true);
  const drag = useRef<Drag | null>(null);
  const shownStamp = useRef(0);
  const [chain, setChain] = useState<Pos[]>([]);
  const [rejected, setRejected] = useState<Rejection | null>(null);
  const [pops, setPops] = useState<ScorePopState[]>([]);

  const { muted } = useSound();
  const { playScore, playGameOver } = useGameSounds();
  const haptics = useHaptics();

  gridRef.current = grid;
  mutedRef.current = muted;

  const boardPoint = (event: ReactPointerEvent<HTMLDivElement>): Point | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (rect.width === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.width) * 100,
    };
  };

  /** Applies the latest pointer position to the drag. Runs at most once per frame. */
  const advance = (active: Drag) => {
    active.frame = 0;
    const point = active.pending;
    active.pending = null;
    const cell = point ? cellAt(point) : null;
    if (!cell) return;

    const key = cellKey(cell);
    if (key === active.lastKey) return;
    active.lastKey = key;

    const result = extendChain(gridRef.current, active.chain, cell);
    if (result.status === "unchanged") return;
    if (result.status === "rejected") {
      playRejectTone(!mutedRef.current);
      setRejected((prev) => ({ pos: cell, stamp: (prev?.stamp ?? 0) + 1 }));
      return;
    }
    active.chain = [...result.chain];
    setChain(active.chain);
    if (result.status === "added") playLinkTone(active.chain.length - 1, !mutedRef.current);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (over || drag.current) return;
    const point = boardPoint(event);
    const start = point ? cellAt(point) : null;
    if (!start || getTile(gridRef.current, start) === null) return;
    if (mode !== "chain") {
      onTap?.(start);
      return;
    }

    primeAudio(!mutedRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, chain: [start], pending: null, frame: 0, lastKey: cellKey(start) };
    setChain([start]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    active.pending = boardPoint(event);
    if (!active.frame) active.frame = requestAnimationFrame(() => advance(active));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    active.pending = boardPoint(event);
    if (active.frame) {
      cancelAnimationFrame(active.frame);
    }
    advance(active);
    drag.current = null;
    setChain([]);
    if (active.chain.length >= 2) onCommit(active.chain);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    if (active.frame) cancelAnimationFrame(active.frame);
    drag.current = null;
    setChain([]);
  };

  useEffect(
    () => () => {
      const active = drag.current;
      if (active?.frame) cancelAnimationFrame(active.frame);
      drag.current = null;
    },
    [],
  );

  // Merge feedback runs once per new merge: pop, particles, score pop, haptic and sound.
  useEffect(() => {
    if (!merge || merge.stamp === shownStamp.current) return;
    shownStamp.current = merge.stamp;
    const board = boardRef.current;
    if (!board) return;

    const centre = cellCentre(merge.at);
    const x = (centre.x / 100) * board.clientWidth;
    const y = (centre.y / 100) * board.clientWidth;
    const colours = [tileColours(merge.value).background, tileColours(merge.value * 2).background];
    particlesRef.current?.burst(x, y, colours, { count: 24, speed: [140, 340], size: [3, 7], life: 0.55 });
    setPops((prev) => [...prev, { id: merge.stamp, points: merge.points, x, y }]);
    haptics.pulse(HAPTICS.clear);
    playScore();
  }, [merge, haptics, playScore]);

  useEffect(() => {
    if (over) {
      haptics.pulse(HAPTICS.gameOver);
      playGameOver();
    }
  }, [over, haptics, playGameOver]);

  const tip = chain[chain.length - 1];
  const previewValue = chain.length >= 2 && tip ? nextPowerOfTwoAtLeast(chainSum(grid, chain)) : null;
  const selected = useMemo(() => new Set(chain.map(cellKey)), [chain]);
  const spawns = useMemo(() => spawnFromRows(merge), [merge]);
  const trail = chain.map((pos) => {
    const c = cellCentre(pos);
    return `${c.x},${c.y}`;
  });

  const tiles: ReactElement[] = [];
  grid.forEach((cells, row) =>
    cells.forEach((value, col) => {
      if (value === null) return;
      const pos = { row, col };
      const key = cellKey(pos);
      const id = ids[row]?.[col] ?? null;
      const isTip = tip !== undefined && key === cellKey(tip);
      const spawnFrom = spawns.get(key);
      const rejection = rejected && cellKey(rejected.pos) === key ? rejected.stamp : 0;
      tiles.push(
        <Tile
          key={id ?? key}
          pos={pos}
          value={isTip && previewValue !== null ? previewValue : value}
          selected={selected.has(key) || (pending !== null && cellKey(pending) === key)}
          preview={isTip && previewValue !== null}
          pop={merge?.tileId != null && merge.tileId === id ? merge.stamp : 0}
          spawnStamp={spawnFrom !== undefined && merge ? merge.stamp : 0}
          fromRow={spawnFrom ?? 0}
          reject={rejection}
        />,
      );
    }),
  );

  const slots: ReactElement[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { x, y } = cellOffset({ row, col });
      slots.push(<div key={`${row},${col}`} className="slot" style={{ transform: `translate(${x}cqw, ${y}cqw)` }} />);
    }
  }

  return (
    <div
      ref={boardRef}
      className={[over ? "board over" : "board", `mode-${mode}`].join(" ")}
      role="application"
      aria-label="Chain Rush board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {slots}
      {tiles}
      <svg className="trail" viewBox={`0 0 100 ${BOARD_HEIGHT}`} aria-hidden="true">
        {trail.length >= 2 && <polyline points={trail.join(" ")} />}
      </svg>
      {pops.map((pop) => (
        <ScorePop
          key={pop.id}
          points={pop.points}
          x={pop.x}
          y={pop.y}
          onDone={() => setPops((prev) => prev.filter((p) => p.id !== pop.id))}
        />
      ))}
      <ParticleLayer ref={particlesRef} />
    </div>
  );
}

/**
 * For each spawned cell, the row it falls from. Spawns in a column stack above the tiles already
 * there, so a new tile starts above the board, far enough up to fall past every tile spawned before
 * it in that column.
 */
export function spawnFromRows(merge: MergeEvent | null): Map<string, number> {
  const offsets = new Map<string, number>();
  if (!merge) return offsets;
  const perColumn = new Map<number, number>();
  for (const pos of merge.spawned) perColumn.set(pos.col, (perColumn.get(pos.col) ?? 0) + 1);
  for (const pos of merge.spawned) offsets.set(cellKey(pos), pos.row - (perColumn.get(pos.col) ?? 0));
  return offsets;
}
