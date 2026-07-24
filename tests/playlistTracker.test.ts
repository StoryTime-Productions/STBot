import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  db: {
    playlistEntry: { findUnique: vi.fn(), upsert: vi.fn() },
    playlistWeekStatus: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("../src/lib/playlistSheet.js", () => ({
  fetchSheetCsv: vi.fn().mockResolvedValue("csv"),
  parseSheet: vi.fn(),
}));

const { db } = await import("../src/lib/db.js");
const { parseSheet } = await import("../src/lib/playlistSheet.js");
const { getCurrentWeekSummary, pollPlaylistSheet } = await import("../src/lib/playlistTracker.js");

describe("pollPlaylistSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.playlistWeekStatus.findUnique).mockResolvedValue(null);
  });

  it("reports a new entry when none existed before, and upserts it", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "56 h left", entries: { Alex: "Song A" } }],
    });
    vi.mocked(db.playlistEntry.findUnique).mockResolvedValueOnce(null);

    const result = await pollPlaylistSheet("sheet-1");

    expect(result.newEntries).toEqual([{ weekNumber: 1, person: "Alex", entry: "Song A" }]);
    expect(db.playlistEntry.upsert).toHaveBeenCalledWith({
      where: { weekNumber_person: { weekNumber: 1, person: "Alex" } },
      create: { weekNumber: 1, person: "Alex", entry: "Song A" },
      update: { entry: "Song A" },
    });
  });

  it("does not report an entry that hasn't changed", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "56 h left", entries: { Alex: "Song A" } }],
    });
    vi.mocked(db.playlistEntry.findUnique).mockResolvedValueOnce({
      id: 1,
      weekNumber: 1,
      person: "Alex",
      entry: "Song A",
      updatedAt: new Date(),
    });

    const result = await pollPlaylistSheet("sheet-1");

    expect(result.newEntries).toEqual([]);
    expect(db.playlistEntry.upsert).not.toHaveBeenCalled();
  });

  it("reports a changed entry (same person/week, different text)", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "56 h left", entries: { Alex: "Song B" } }],
    });
    vi.mocked(db.playlistEntry.findUnique).mockResolvedValueOnce({
      id: 1,
      weekNumber: 1,
      person: "Alex",
      entry: "Song A",
      updatedAt: new Date(),
    });

    const result = await pollPlaylistSheet("sheet-1");

    expect(result.newEntries).toEqual([{ weekNumber: 1, person: "Alex", entry: "Song B" }]);
  });

  it("reports a completed week on the not-done -> DONE transition", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" } }],
    });
    vi.mocked(db.playlistEntry.findUnique).mockResolvedValueOnce({
      id: 1,
      weekNumber: 1,
      person: "Alex",
      entry: "Song A",
      updatedAt: new Date(),
    });
    vi.mocked(db.playlistWeekStatus.findUnique).mockResolvedValueOnce({
      weekNumber: 1,
      status: "12 h left",
    });

    const result = await pollPlaylistSheet("sheet-1");

    expect(result.completedWeeks).toEqual([
      { weekNumber: 1, entries: { Alex: "Song A" }, contributorCount: 1, totalPeople: 2 },
    ]);
  });

  it("does not re-report a week that was already DONE last poll", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" } }],
    });
    vi.mocked(db.playlistEntry.findUnique).mockResolvedValueOnce({
      id: 1,
      weekNumber: 1,
      person: "Alex",
      entry: "Song A",
      updatedAt: new Date(),
    });
    vi.mocked(db.playlistWeekStatus.findUnique).mockResolvedValueOnce({
      weekNumber: 1,
      status: "DONE",
    });

    const result = await pollPlaylistSheet("sheet-1");

    expect(result.completedWeeks).toEqual([]);
  });
});

describe("getCurrentWeekSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the first non-DONE week", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [
        { weekNumber: 1, status: "DONE", entries: { Alex: "Song A", Sam: "Song B" } },
        { weekNumber: 2, status: "12 h left", entries: { Alex: "Song C" } },
        { weekNumber: 3, status: "NOT STARTED YET", entries: {} },
      ],
    });

    const summary = await getCurrentWeekSummary("sheet-1");

    expect(summary).toEqual({
      weekNumber: 2,
      status: "12 h left",
      entries: { Alex: "Song C" },
      contributorCount: 1,
      totalPeople: 2,
    });
  });

  it("returns undefined when every week is DONE", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" } }],
    });

    const summary = await getCurrentWeekSummary("sheet-1");

    expect(summary).toBeUndefined();
  });
});
