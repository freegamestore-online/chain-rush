import { describe, expect, it } from "vitest";
import { isPowerOfTwo } from "./grid";

describe("isPowerOfTwo", () => {
  it("checks powers above the 32-bit bitwise range correctly", () => {
    expect(isPowerOfTwo(2 ** 40)).toBe(true);
    expect(isPowerOfTwo(2 ** 32 + 2)).toBe(false);
  });
});
