import { describe, expect, it } from "vitest";
import { dailyGame } from "./daily";
import { type ChainState, fileFrom, freshState, initialState, toSaved } from "./useChainGame";
import {
  STATE_KEY,
  type KeyValueStore,
  parseSavedFile,
  readSavedFile,
  serializeSavedFile,
  writeSavedFile,
} from "./storage";

/** An in-memory store, standing in for localStorage. */
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

/** A game part way through, so the snapshot, helpers, and ids all carry real data. */
function playedEndless(seed: number): ChainState {
  const state = freshState("endless", "2026-10-16", seed);
  return { ...state, game: { ...state.game, score: 120, moves: 3, helpers: { hammer: 2, swap: 0, shuffle: 1 } } };
}

describe("save and restore", () => {
  it("round-trips an endless game through localStorage", () => {
    const state = playedEndless(7);
    const store = memoryStore();
    writeSavedFile(store, fileFrom(state));

    const restored = initialState(readSavedFile(store), "2026-10-16", 1);
    expect(restored.game).toEqual(state.game);
    expect(restored.ids).toEqual(state.ids);
    expect(restored.mode).toBe("endless");
    expect(restored.date).toBeNull();
  });

  it("round-trips Rush with its remaining clock time", () => {
    const rush = { ...freshState("rush", "2026-10-16", 17), remainingMs: 32_500 };
    const store = memoryStore();
    writeSavedFile(store, fileFrom(rush));
    const restored = initialState(readSavedFile(store), "2026-10-16", 1);
    expect(restored.mode).toBe("rush");
    expect(restored.remainingMs).toBe(32_500);
  });

  it("round-trips a daily game and keeps the endless game parked", () => {
    const endless = playedEndless(8);
    const daily = { ...freshState("daily", "2026-10-16", 0), parked: {} };
    const withParked: ChainState = { ...daily, parked: { endless: toSaved(endless) } };

    const store = memoryStore();
    writeSavedFile(store, fileFrom(withParked));
    const restored = initialState(readSavedFile(store), "2026-10-16", 1);

    expect(restored.mode).toBe("daily");
    expect(restored.game.grid).toEqual(dailyGame("2026-10-16").grid);
    expect(restored.parked.endless?.game).toEqual(endless.game);
  });

  it("drops a daily game saved for a previous date", () => {
    const state = freshState("daily", "2026-10-15", 0);
    const store = memoryStore();
    writeSavedFile(store, fileFrom(state));
    const restored = initialState(readSavedFile(store), "2026-10-16", 1);
    expect(restored.mode).toBe("daily");
    expect(restored.date).toBe("2026-10-16");
    expect(restored.game.grid).toEqual(dailyGame("2026-10-16").grid);
  });

  it("starts a fresh endless game when nothing is saved", () => {
    const restored = initialState(readSavedFile(memoryStore()), "2026-10-16", 9);
    expect(restored.mode).toBe("endless");
    expect(restored.game.score).toBe(0);
  });

  it("serialises and parses to the same file", () => {
    const file = fileFrom(playedEndless(4));
    expect(parseSavedFile(serializeSavedFile(file))).toEqual(file);
  });
});

describe("graceful failure", () => {
  it.each([
    ["not JSON", "{not json"],
    ["a JSON scalar", "42"],
    ["an array", "[]"],
    ["a wrong version", JSON.stringify({ version: 2, active: "endless", slots: {} })],
    ["an unknown mode", JSON.stringify({ version: 1, active: "hard", slots: {} })],
  ])("returns null for %s", (_label, raw) => {
    expect(parseSavedFile(raw)).toBeNull();
  });

  it("returns null when the board is the wrong shape", () => {
    const file = JSON.parse(serializeSavedFile(fileFrom(playedEndless(5))));
    file.slots.endless.game.grid = [[2, 2]];
    expect(parseSavedFile(JSON.stringify(file))).toBeNull();
  });

  it("returns null when a tile is not a power of two", () => {
    const file = JSON.parse(serializeSavedFile(fileFrom(playedEndless(5))));
    file.slots.endless.game.grid[0][0] = 3;
    expect(parseSavedFile(JSON.stringify(file))).toBeNull();
  });

  it("returns null for a non-power-of-two tile above the 32-bit range", () => {
    const file = JSON.parse(serializeSavedFile(fileFrom(playedEndless(5))));
    file.slots.endless.game.grid[0][0] = 2 ** 32 + 2;
    expect(parseSavedFile(JSON.stringify(file))).toBeNull();
  });

  it("returns null when ids do not line up with the board", () => {
    const file = JSON.parse(serializeSavedFile(fileFrom(playedEndless(5))));
    file.slots.endless.ids[0][0] = file.slots.endless.ids[0][0] === null ? 1 : null;
    expect(parseSavedFile(JSON.stringify(file))).toBeNull();
  });

  it("returns null when a daily slot has no date, or an endless slot has one", () => {
    const file = JSON.parse(serializeSavedFile(fileFrom(freshState("daily", "2026-10-16", 0))));
    file.slots.daily.date = null;
    expect(parseSavedFile(JSON.stringify(file))).toBeNull();
  });

  it("starts fresh rather than crashing when the save is corrupt", () => {
    const store = memoryStore({ [STATE_KEY]: "{garbage" });
    const restored = initialState(readSavedFile(store), "2026-10-16", 3);
    expect(restored.mode).toBe("endless");
    expect(restored.game.moves).toBe(0);
  });

  it("reads as empty when the store throws", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    expect(readSavedFile(broken)).toBeNull();
  });

  it("keeps playing when the store is full", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeSavedFile(full, fileFrom(playedEndless(6)))).not.toThrow();
  });

  it("works with no store at all", () => {
    expect(readSavedFile(null)).toBeNull();
    expect(() => writeSavedFile(null, fileFrom(playedEndless(6)))).not.toThrow();
  });
});
