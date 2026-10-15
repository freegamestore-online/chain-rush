import { type GameState, newGame } from "../engine";

/** Chains allowed in one daily board. The limit is shared by every player on the same date. */
export const DAILY_MOVES = 30;

const DAILY_SALT = "chain-rush:daily:";

/** Today's date in UTC as YYYY-MM-DD, so every player gets the same daily board on a given date. */
export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** 32-bit FNV-1a hash of the date, salted, used as the RNG seed for that day's board. */
export function dailySeed(date: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${DAILY_SALT}${date}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The opening board for a date. The same date always gives the same board. */
export function dailyGame(date: string): GameState {
  return newGame(dailySeed(date));
}
