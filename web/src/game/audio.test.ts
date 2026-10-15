import { describe, expect, it } from "vitest";
import { linkFrequency } from "./audio";

describe("linkFrequency", () => {
  it("rises with every link", () => {
    for (let link = 1; link <= 12; link++) {
      expect(linkFrequency(link)).toBeGreaterThan(linkFrequency(link - 1));
    }
  });

  it("starts at C4 and steps two semitones per link", () => {
    expect(linkFrequency(0)).toBeCloseTo(262, 6);
    expect(linkFrequency(1) / linkFrequency(0)).toBeCloseTo(2 ** (2 / 12), 9);
  });

  it("stops rising after twelve links", () => {
    expect(linkFrequency(20)).toBeCloseTo(linkFrequency(12), 9);
  });
});
