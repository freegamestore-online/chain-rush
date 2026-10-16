import { describe, expect, it } from "vitest";
import { hasValidChain } from "../engine";
import { DAILY_MOVES, dailyGame, dailySeed, isDateString, utcDate } from "./daily";

describe("daily board", () => {
  it("is reproducible: the same date always gives the same board", () => {
    expect(dailyGame("2026-10-16").grid).toEqual(dailyGame("2026-10-16").grid);
    expect(dailySeed("2026-10-16")).toBe(dailySeed("2026-10-16"));
  });

  it("differs from one date to the next", () => {
    expect(dailyGame("2026-10-16").grid).not.toEqual(dailyGame("2026-10-17").grid);
    expect(dailySeed("2026-10-16")).not.toBe(dailySeed("2026-10-17"));
  });

  it("opens with a full board that has a chain", () => {
    const game = dailyGame("2026-01-01");
    expect(game.grid.flat().every((tile) => tile !== null)).toBe(true);
    expect(hasValidChain(game.grid)).toBe(true);
    expect(game.score).toBe(0);
    expect(game.moves).toBe(0);
  });

  it("has a named move limit", () => {
    expect(DAILY_MOVES).toBe(30);
  });
});

describe("utcDate", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    expect(utcDate(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-16");
    expect(utcDate(new Date("2026-10-17T00:30:00Z"))).toBe("2026-10-17");
  });
});

describe("isDateString", () => {
  it.each(["2026-10-16", "2024-02-29"])("accepts %s", (value) => {
    expect(isDateString(value)).toBe(true);
  });

  it.each([
    "2026-13-01",
    "2026-02-30",
    "2026-04-31",
    "2025-02-29",
    "16-10-2026",
    "2026-10-16T00:00",
    "",
    null,
    20261016,
  ])("rejects %j", (value) => {
    expect(isDateString(value)).toBe(false);
  });
});
