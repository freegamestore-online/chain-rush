import { type GameState, newGame } from "../engine";

/** Chains allowed in one daily board. The limit is shared by every player on the same date. */
export const DAILY_MOVES = 30;

const DAILY_SALT = "chain-rush:daily:";

/** Today's date in UTC as YYYY-MM-DD, so every player gets the same daily board on a given date. */
export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Time remaining until the next UTC daily board, formatted as HH:MM:SS. */
export function timeToNextDaily(now: Date = new Date()): string {
  const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const seconds = Math.max(0, Math.ceil((nextUtcDay - now.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year ?? 0, (month ?? 0) - 1, day ?? 0);
  return date.toISOString().slice(0, 10) === value;
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
