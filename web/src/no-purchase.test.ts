import { describe, expect, it } from "vitest";

/*
 * Chain Rush has no purchase flow: helpers are earned through play, and nothing in the app asks for
 * money. These checks scan the shipped source for purchase and paywall vocabulary and for payment
 * SDKs, so a change that adds either fails here. Vite's ?raw imports keep this free of Node types.
 */

const SOURCES = import.meta.glob("./**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
const PACKAGE_JSON = import.meta.glob("../package.json", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const BANNED = /\b(purchase|paywall|checkout|stripe|in-app|buy now|add to cart|price tag|subscribe)\b/i;

describe("no purchase flow", () => {
  it("has no purchase or paywall wording in the shipped source", () => {
    // Guard against the glob matching nothing, which would make the scan pass for free.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const hits = Object.keys(SOURCES).filter((path) => !/\.test\.tsx?$/.test(path) && BANNED.test(SOURCES[path] ?? ""));
    expect(hits).toEqual([]);
  });

  it("has no payment SDK in the dependencies", () => {
    const pkg = JSON.parse(Object.values(PACKAGE_JSON)[0] ?? "{}") as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((name) => /stripe|paddle|paypal|revenuecat|braintree/i.test(name))).toEqual([]);
  });
});
