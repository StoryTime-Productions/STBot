import { describe, expect, it } from "vitest";
import { isWeeklySummaryTick } from "../src/lib/playlistSchedule.js";

describe("isWeeklySummaryTick", () => {
  it("is true at Monday 00:00 Eastern in winter (05:00 UTC)", () => {
    expect(isWeeklySummaryTick(new Date("2026-11-23T05:00:00Z"))).toBe(true);
  });

  it("is true at Monday 00:00 Eastern in summer (04:00 UTC)", () => {
    expect(isWeeklySummaryTick(new Date("2026-07-06T04:00:00Z"))).toBe(true);
  });

  it("still covers a late start inside the first five minutes", () => {
    expect(isWeeklySummaryTick(new Date("2026-11-23T05:04:59Z"))).toBe(true);
    expect(isWeeklySummaryTick(new Date("2026-11-23T05:05:00Z"))).toBe(false);
  });

  it("is false at the next poll and at other hours of Monday", () => {
    expect(isWeeklySummaryTick(new Date("2026-11-23T05:30:00Z"))).toBe(false);
    expect(isWeeklySummaryTick(new Date("2026-11-23T15:00:00Z"))).toBe(false);
  });

  it("is false just before midnight Sunday and at midnight on other days", () => {
    expect(isWeeklySummaryTick(new Date("2026-11-23T04:59:00Z"))).toBe(false);
    expect(isWeeklySummaryTick(new Date("2026-11-24T05:00:00Z"))).toBe(false);
  });

  it("does not mistake UTC midnight for Eastern midnight", () => {
    expect(isWeeklySummaryTick(new Date("2026-11-23T00:00:00Z"))).toBe(false);
  });
});
