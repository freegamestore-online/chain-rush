import { expect, test, type Page } from "@playwright/test";

type Cell = { row: number; col: number; value: number };
type PointCell = Cell & { x: number; y: number };

const consoleErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("https://auth.freegamestore.online/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.afterEach(async ({ page }) => {
  const relevantErrors = (consoleErrors.get(page) ?? []).filter(
    (error) => !error.includes("auth.freegamestore.online"),
  );
  expect(relevantErrors).toEqual([]);
});

async function readTiles(page: Page): Promise<PointCell[]> {
  const board = page.getByRole("application", { name: "Chain Rush board" });
  const rect = await board.boundingBox();
  if (!rect) throw new Error("Board is not visible");
  return page.getByTestId("board-tile").evaluateAll((tiles) =>
    tiles.map((tile) => {
      const box = tile.getBoundingClientRect();
      const node = tile as HTMLElement;
      const face = node.querySelector<HTMLElement>("[data-value]");
      return {
        row: Number(node.dataset.row),
        col: Number(node.dataset.col),
        value: Number(face?.dataset.value),
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
      };
    }),
    rect,
  );
}

function findChain(tiles: PointCell[], minLength = 2): PointCell[] | null {
  const byCell = new Map(tiles.map((tile) => [`${tile.row},${tile.col}`, tile]));
  const walk = (path: PointCell[], used: Set<string>): PointCell[] | null => {
    if (path.length >= minLength) return path;
    const last = path[path.length - 1];
    if (!last) return null;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const key = `${last.row + dr},${last.col + dc}`;
        const next = byCell.get(key);
        if (!next || next.value !== path[0]?.value || used.has(key)) continue;
        const result = walk([...path, next], new Set([...used, key]));
        if (result) return result;
      }
    }
    return null;
  };

  for (const tile of tiles) {
    const result = walk([tile], new Set([`${tile.row},${tile.col}`]));
    if (result) return result;
  }
  return null;
}

async function dragChain(page: Page, minimum = 2): Promise<number> {
  const tiles = await readTiles(page);
  const chain = findChain(tiles, minimum);
  if (!chain) throw new Error(`No same-value adjacent chain of length ${minimum} found`);
  const first = chain[0];
  if (!first) throw new Error("Chain had no starting tile");
  const scoreBefore = Number(await page.getByTestId("score-value").innerText());
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const tile of chain.slice(1)) await page.mouse.move(tile.x, tile.y, { steps: 3 });
  const last = chain[chain.length - 1];
  if (last) await page.mouse.up({});
  await expect.poll(async () => Number(await page.getByTestId("score-value").innerText())).toBeGreaterThan(scoreBefore);
  // The board animates tiles for 380ms after gravity/refill. Wait for their displayed positions
  // to settle before locating the next real pointer path.
  await page.waitForTimeout(420);
  return chain.length;
}

async function openSeededGame(page: Page, colorScheme: "light" | "dark" = "light") {
  await page.emulateMedia({ colorScheme });
  await page.goto("/?seed=42");
  await expect(page.getByRole("application", { name: "Chain Rush board" })).toBeVisible();
  await expect(page.getByTestId("board-cell")).toHaveCount(40);
}

async function seedDailyGameOneMoveFromLimit(page: Page) {
  const date = new Date().toISOString().slice(0, 10);
  await page.addInitScript((today) => {
    const grid = Array.from({ length: 8 }, () => Array.from({ length: 5 }, () => 2));
    const ids = Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => row * 5 + col + 1),
    );
    localStorage.setItem(
      "chain-rush-state",
      JSON.stringify({
        version: 1,
        active: "daily",
        slots: {
          daily: {
            date: today,
            game: {
              grid,
              score: 0,
              highest: 2,
              helpers: { hammer: 1, swap: 1, shuffle: 1 },
              rngState: 123456789,
              moves: 29,
              over: false,
              undo: null,
              celebrated: 0,
            },
            ids,
            undoIds: null,
            nextId: 41,
          },
        },
      }),
    );
  }, date);
}

test("light-mode seeded phone play-through", async ({ page }) => {
  await openSeededGame(page);
  const initialScore = await page.getByTestId("score-value").innerText();
  const length = await dragChain(page, 3);
  expect(length).toBeGreaterThanOrEqual(3);
  expect(Number(await page.getByTestId("score-value").innerText())).toBeGreaterThan(Number(initialScore));
  await page.screenshot({ path: "e2e/screenshots/phone-light.png" });
});

test("dark-mode seeded phone play-through", async ({ page }) => {
  await openSeededGame(page, "dark");
  const length = await dragChain(page, 3);
  expect(length).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: "e2e/screenshots/phone-dark.png" });
});

test("undo restores the score after a chain", async ({ page }) => {
  await openSeededGame(page);
  const before = await page.getByTestId("score-value").innerText();
  await dragChain(page);
  await expect(page.getByTestId("score-value")).not.toHaveText(before);
  await page.getByTestId("game-helpers").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("score-value")).toHaveText(before);
});

test("daily challenge completes and records its score", async ({ page }) => {
  await seedDailyGameOneMoveFromLimit(page);
  await openSeededGame(page);
  await expect(page.getByTestId("game-status")).toContainText("1 moves left");
  await dragChain(page);
  await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Play Again" }).click();
  await page.getByTestId("game-modes").getByRole("button", { name: "Scores" }).click();
  await expect(page.getByTestId("leaderboard")).toContainText("Today's daily:");
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`daily challenge is available on a ${colorScheme}-mode phone`, async ({ page }) => {
    await openSeededGame(page, colorScheme);
    await page.getByTestId("game-modes").getByRole("button", { name: "Daily" }).click();
    await expect(page.getByTestId("game-status")).toContainText(/^Daily \d{4}-\d{2}-\d{2} · 30 moves left$/);
    await expect(page.getByTestId("daily-countdown")).toContainText(/^Next daily in \d{2}:\d{2}:\d{2} UTC$/);
    await expect(page.getByRole("application", { name: "Chain Rush board" })).toBeVisible();
    await expect(page.getByTestId("board-cell")).toHaveCount(40);
    await page.screenshot({ path: `e2e/screenshots/daily-phone-${colorScheme}.png` });
  });
}

test("Rush mode is selectable and ends when its one-minute clock expires", async ({ page }) => {
  await openSeededGame(page);
  await page.clock.install({ time: new Date("2026-10-20T00:00:00Z") });
  await page.getByTestId("game-modes").getByRole("button", { name: "Rush" }).click();
  await expect(page.getByTestId("game-status")).toContainText("60 seconds left");
  await page.clock.fastForward(60_100);
  await expect(page.getByTestId("game-over")).toBeVisible();
  await expect(page.getByTestId("game-over")).toContainText("Rush over");
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem("chain-rush-leaderboard") ?? "{}"));
  expect(scores.rush).toBe(0);
  expect(scores.endless).toBe(0);
});

test("hammer helper consumes a use and keeps the score unchanged", async ({ page }) => {
  await openSeededGame(page);
  const score = await page.getByTestId("score-value").innerText();
  await page.getByTestId("game-helpers").getByRole("button", { name: "Hammer ×1" }).click();
  const tile = await page.getByTestId("board-tile").first().boundingBox();
  if (!tile) throw new Error("No tile is visible to hammer");
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await expect(page.getByTestId("game-helpers").getByRole("button", { name: "Hammer ×0" })).toBeVisible();
  await expect(page.getByTestId("score-value")).toHaveText(score);
});

test("phone layout has no horizontal overflow before or after a move", async ({ page }) => {
  await openSeededGame(page);
  const hasNoOverflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await hasNoOverflow()).toBe(true);
  await dragChain(page);
  expect(await hasNoOverflow()).toBe(true);
});
