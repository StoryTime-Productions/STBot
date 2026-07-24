import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/lib/formatDuration.js";

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("formats sub-hour durations as minutes", () => {
    expect(formatDuration(5 * 60_000)).toBe("5m");
  });

  it("formats durations over an hour as hours and minutes", () => {
    expect(formatDuration(2 * 3_600_000 + 15 * 60_000)).toBe("2h 15m");
  });

  it("throws on negative durations", () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
  });
});
