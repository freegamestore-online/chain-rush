import { describe, expect, it } from "vitest";
import { contrastRatio, tileColours } from "./colours";

describe("tileColours", () => {
  it("gives each power of two its own background", () => {
    const backgrounds = [2, 4, 8, 16, 32, 64, 128, 256, 512].map((v) => tileColours(v).background);
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  it("picks the text colour with the higher contrast on every step of the ramp", () => {
    for (let exponent = 1; exponent <= 12; exponent++) {
      const { background, text } = tileColours(2 ** exponent);
      const dark = contrastRatio(background, "#1a1a1a");
      const light = contrastRatio(background, "#ffffff");
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(Math.max(dark, light) - 1e-9);
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps large values on the last step rather than running off the ramp", () => {
    expect(tileColours(2 ** 30).background).toBe(tileColours(2 ** 25).background);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 9);
  });
});
