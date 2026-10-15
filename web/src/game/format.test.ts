import { describe, expect, it } from "vitest";
import { formatValue, isMilestone } from "./format";

describe("formatValue", () => {
  it.each([
    [2, "2"],
    [256, "256"],
    [512, "512"],
    [1024, "1K"],
    [2048, "2K"],
    [512 * 1024, "512K"],
    [1024 * 1024, "1M"],
  ])("%i is shown as %s", (value, label) => {
    expect(formatValue(value)).toBe(label);
  });
});

describe("isMilestone", () => {
  it("is true from 512 up, for powers of two only", () => {
    expect(isMilestone(256)).toBe(false);
    expect(isMilestone(512)).toBe(true);
    expect(isMilestone(1024)).toBe(true);
    expect(isMilestone(1 << 20)).toBe(true);
  });
});
