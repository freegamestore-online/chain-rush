import { describe, expect, it } from "vitest";
import { formatValue } from "./format";

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
