import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./reducedMotion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("is true when the system asks for reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    expect(prefersReducedMotion()).toBe(true);
  });

  it("is false when the system does not", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is false where matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
