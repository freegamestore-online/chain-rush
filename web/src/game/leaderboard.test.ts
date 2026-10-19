import { describe, expect, it } from "vitest";
import {
  EMPTY_LEADERBOARD,
  LEADERBOARD_KEY,
  MAX_DAILY_ENTRIES,
  parseLeaderboard,
  readLeaderboard,
  recentDaily,
  recordDaily,
  recordEndless,
  recordRush,
  writeLeaderboard,
} from "./leaderboard";
import type { KeyValueStore } from "./storage";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("endless best score", () => {
  it("keeps the highest score recorded", () => {
    let board = EMPTY_LEADERBOARD;
    board = recordEndless(board, 300);
    board = recordEndless(board, 120);
    board = recordEndless(board, 450);
    expect(board.endless).toBe(450);
    expect(board.rush).toBe(0);
  });

  it("keeps a separate best Rush score", () => {
    const board = recordRush(recordRush(EMPTY_LEADERBOARD, 500), 200);
    expect(board.rush).toBe(500);
    expect(board.endless).toBe(0);
  });

  it("ignores a score that is not a whole, non-negative number", () => {
    const board = recordEndless(EMPTY_LEADERBOARD, 200);
    expect(recordEndless(board, -5)).toBe(board);
    expect(recordEndless(board, 3.5)).toBe(board);
    expect(recordEndless(board, Number.NaN)).toBe(board);
  });
});

describe("daily scores", () => {
  it("keeps the best score per date and leaves other dates alone", () => {
    let board = recordDaily(EMPTY_LEADERBOARD, "2026-10-16", 80);
    board = recordDaily(board, "2026-10-16", 50);
    board = recordDaily(board, "2026-10-17", 60);
    expect(board.daily).toEqual({ "2026-10-16": 80, "2026-10-17": 60 });
  });

  it("skips an invalid date rather than recording it", () => {
    expect(recordDaily(EMPTY_LEADERBOARD, "16/10/2026", 99)).toBe(EMPTY_LEADERBOARD);
  });

  it("lists the newest dates first", () => {
    let board = EMPTY_LEADERBOARD;
    for (const date of ["2026-10-14", "2026-10-16", "2026-10-15"]) board = recordDaily(board, date, 10);
    expect(recentDaily(board, 2).map((entry) => entry.date)).toEqual(["2026-10-16", "2026-10-15"]);
  });

  it("keeps only the most recent entries", () => {
    let board = EMPTY_LEADERBOARD;
    for (let day = 0; day < MAX_DAILY_ENTRIES + 5; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      board = recordDaily(board, date, day);
    }
    const dates = Object.keys(board.daily).sort();
    expect(dates).toHaveLength(MAX_DAILY_ENTRIES);
    expect(dates[dates.length - 1]).toBe(new Date(Date.UTC(2026, 0, MAX_DAILY_ENTRIES + 5)).toISOString().slice(0, 10));
  });
});

describe("invalid entries are skipped quietly", () => {
  it("keeps the valid daily entries and drops the bad ones", () => {
    const raw = JSON.stringify({
      endless: 250,
      daily: {
        "2026-10-16": 70,
        "not-a-date": 10,
        "2026-10-15": "forty",
        "2026-10-14": -3,
        "2026-10-13": 2.5,
      },
    });
    expect(parseLeaderboard(raw)).toEqual({ endless: 250, rush: 0, daily: { "2026-10-16": 70 } });
  });

  it("reads a bad endless best as zero", () => {
    expect(parseLeaderboard(JSON.stringify({ endless: "lots", daily: {} })).endless).toBe(0);
  });

  it("reads corrupt JSON as an empty board", () => {
    expect(parseLeaderboard("{oops")).toEqual(EMPTY_LEADERBOARD);
    expect(parseLeaderboard("[1,2]")).toEqual(EMPTY_LEADERBOARD);
    expect(parseLeaderboard(null)).toEqual(EMPTY_LEADERBOARD);
  });

  it("treats a daily section that is not an object as empty", () => {
    expect(parseLeaderboard(JSON.stringify({ endless: 5, daily: [1, 2] }))).toEqual({ endless: 5, rush: 0, daily: {} });
  });
});

describe("storage", () => {
  it("writes and reads back the same board", () => {
    const store = memoryStore();
    const board = recordDaily(recordEndless(EMPTY_LEADERBOARD, 310), "2026-10-16", 90);
    writeLeaderboard(store, board);
    expect(store.data[LEADERBOARD_KEY]).toBeDefined();
    expect(readLeaderboard(store)).toEqual(board);
  });

  it("reads an empty board when the store throws or is missing", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    expect(readLeaderboard(broken)).toEqual(EMPTY_LEADERBOARD);
    expect(readLeaderboard(null)).toEqual(EMPTY_LEADERBOARD);
  });
});
