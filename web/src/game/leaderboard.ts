import { useCallback, useEffect, useState } from "react";
import { isDateString } from "./daily";
import { type KeyValueStore, browserStore } from "./storage";

/** The local leaderboard: the best endless score, and the best score for each daily date. */
export interface Leaderboard {
  endless: number;
  rush: number;
  daily: Record<string, number>;
}

export interface DailyEntry {
  date: string;
  score: number;
}

export const LEADERBOARD_KEY = "chain-rush-leaderboard";

/** Daily entries kept, newest first. Older dates are dropped so storage stays small. */
export const MAX_DAILY_ENTRIES = 60;

export const EMPTY_LEADERBOARD: Leaderboard = { endless: 0, rush: 0, daily: {} };

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Parses the stored leaderboard. An entry that is missing or invalid is dropped quietly rather than
 * failing the whole board: a bad endless best reads as 0, and a bad daily entry is left out.
 */
export function parseLeaderboard(raw: string | null): Leaderboard {
  if (raw === null) return EMPTY_LEADERBOARD;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_LEADERBOARD;
  }
  if (!isRecord(value)) return EMPTY_LEADERBOARD;

  const daily: Record<string, number> = {};
  if (isRecord(value.daily)) {
    for (const [date, score] of Object.entries(value.daily)) {
      if (isDateString(date) && isCount(score)) daily[date] = score;
    }
  }
  return {
    endless: isCount(value.endless) ? value.endless : 0,
    rush: isCount(value.rush) ? value.rush : 0,
    daily: keepRecent(daily),
  };
}

/** Records an endless score if it beats the best so far. An invalid score leaves the board unchanged. */
export function recordEndless(board: Leaderboard, score: number): Leaderboard {
  if (!isCount(score)) return board;
  return { ...board, endless: Math.max(board.endless, score) };
}

/** Records a Rush score independently from the untimed endless best. */
export function recordRush(board: Leaderboard, score: number): Leaderboard {
  if (!isCount(score)) return board;
  return { ...board, rush: Math.max(board.rush, score) };
}

/** Records a daily score for its date, keeping the best per date. An invalid date or score is skipped. */
export function recordDaily(board: Leaderboard, date: string, score: number): Leaderboard {
  if (!isDateString(date) || !isCount(score)) return board;
  const best = Math.max(board.daily[date] ?? 0, score);
  return { ...board, daily: keepRecent({ ...board.daily, [date]: best }) };
}

/** The most recent daily entries, newest first. */
export function recentDaily(board: Leaderboard, count = 5): DailyEntry[] {
  return Object.entries(board.daily)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, count)
    .map(([date, score]) => ({ date, score }));
}

function keepRecent(daily: Record<string, number>): Record<string, number> {
  const newest = Object.keys(daily)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, MAX_DAILY_ENTRIES);
  return Object.fromEntries(newest.map((date) => [date, daily[date] ?? 0]));
}

/** Reads the leaderboard from storage. A missing or blocked store gives an empty board. */
export function readLeaderboard(store: KeyValueStore | null): Leaderboard {
  try {
    return parseLeaderboard(store?.getItem(LEADERBOARD_KEY) ?? null);
  } catch {
    return EMPTY_LEADERBOARD;
  }
}

export function writeLeaderboard(store: KeyValueStore | null, board: Leaderboard): void {
  try {
    store?.setItem(LEADERBOARD_KEY, JSON.stringify(board));
  } catch {
    // Storage is full or blocked: the board still shows for this visit.
  }
}

/** The local leaderboard for the page, with functions that record a score and persist it. */
export function useLeaderboard() {
  const [store] = useState(browserStore);
  const [board, setBoard] = useState(() => readLeaderboard(store));

  useEffect(() => writeLeaderboard(store, board), [store, board]);

  const recordEndlessScore = useCallback((score: number) => setBoard((prev) => recordEndless(prev, score)), []);
  const recordRushScore = useCallback((score: number) => setBoard((prev) => recordRush(prev, score)), []);
  const recordDailyScore = useCallback(
    (date: string, score: number) => setBoard((prev) => recordDaily(prev, date, score)),
    [],
  );

  return { board, recordEndlessScore, recordRushScore, recordDailyScore };
}
