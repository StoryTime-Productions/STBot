import { describe, expect, it, vi } from "vitest";
import { parseSheet } from "../src/lib/playlistSheet.js";

// Mirrors the real sheet's structure (see docs/specs/03): title/spacer
// rows, a header row with blank col A, decorative % + star columns to the
// right of the person columns, and entries containing embedded commas,
// quotes, and newlines.
const FIXTURE_CSV = [
  ",,,,",
  ",Song Contributions to ST Playlist (on Spotify),,,,Number of Songs:,2",
  ",,,,",
  ",Alex,Sam,Jordan,,,,,,,",
  'Week 1 (DONE),DEAF KEV - Invincible,"""Wake Up, Get Up"" by Lyn",,,100%,,decoration,decoration',
  'Week 2 (56 h left),Formidable - Stromae,,"Claim Your Blessings\n- Mindflip",,67%',
  "Week 3 (NOT STARTED YET),,,",
].join("\n");

describe("parseSheet", () => {
  it("extracts people from the header row, ignoring decorative columns", () => {
    const { people } = parseSheet(FIXTURE_CSV);
    expect(people).toEqual(["Alex", "Sam", "Jordan"]);
  });

  it("parses week number and status from the combined label cell", () => {
    const { weeks } = parseSheet(FIXTURE_CSV);
    expect(weeks.map((w) => [w.weekNumber, w.status])).toEqual([
      [1, "DONE"],
      [2, "56 h left"],
      [3, "NOT STARTED YET"],
    ]);
  });

  it("only includes non-empty entries per week, keyed by person", () => {
    const { weeks } = parseSheet(FIXTURE_CSV);
    expect(weeks[0]?.entries).toEqual({
      Alex: "DEAF KEV - Invincible",
      Sam: '"Wake Up, Get Up" by Lyn',
    });
    expect(weeks[2]?.entries).toEqual({});
  });

  it("correctly parses entries with embedded commas and quotes (real CSV, not naive split)", () => {
    const { weeks } = parseSheet(FIXTURE_CSV);
    expect(weeks[0]?.entries["Sam"]).toBe('"Wake Up, Get Up" by Lyn');
  });

  it("correctly parses entries with embedded newlines", () => {
    const { weeks } = parseSheet(FIXTURE_CSV);
    expect(weeks[1]?.entries["Jordan"]).toBe("Claim Your Blessings\n- Mindflip");
  });

  it("throws a clear error if no week rows can be found", () => {
    expect(() => parseSheet("just,some,unrelated,csv\ndata,here,,")).toThrow(
      /Could not locate week rows/
    );
  });
});

describe("getSheetUrl", () => {
  it("builds a human-viewable spreadsheet link from the sheet id", async () => {
    const { getSheetUrl } = await import("../src/lib/playlistSheet.js");
    expect(getSheetUrl("some-id")).toBe("https://docs.google.com/spreadsheets/d/some-id/edit");
  });
});

describe("columnLetter", () => {
  it("converts 0-based indices to spreadsheet column letters", async () => {
    const { columnLetter } = await import("../src/lib/playlistSheet.js");
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(1)).toBe("B");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
  });
});

describe("getCellA1", () => {
  it("addresses a person's column (offset by the week-label column) and 1-based row", async () => {
    const { getCellA1 } = await import("../src/lib/playlistSheet.js");
    const week = { weekNumber: 1, status: "DONE", entries: {}, rowIndex: 4 };
    expect(getCellA1(week, 0)).toBe("B5"); // person index 0 -> column B, rowIndex 4 -> row 5
    expect(getCellA1(week, 2)).toBe("D5");
  });

  it("prefixes a sheet tab name when given", async () => {
    const { getCellA1 } = await import("../src/lib/playlistSheet.js");
    const week = { weekNumber: 1, status: "DONE", entries: {}, rowIndex: 0 };
    expect(getCellA1(week, 0, "Sheet1")).toBe("Sheet1!B1");
  });
});

describe("parseSheet rowIndex", () => {
  it("records each week's 0-based row index in the parsed CSV", () => {
    const { weeks } = parseSheet(FIXTURE_CSV);
    expect(weeks.map((w) => w.rowIndex)).toEqual([4, 5, 6]);
  });
});

describe("fetchSheetCsv", () => {
  it("throws with the HTTP status on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") })
    );
    const { fetchSheetCsv } = await import("../src/lib/playlistSheet.js");
    await expect(fetchSheetCsv("some-id")).rejects.toThrow(/HTTP 404/);
    vi.unstubAllGlobals();
  });
});
