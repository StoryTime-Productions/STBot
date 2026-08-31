import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  db: {
    playlistFrownFill: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("../src/lib/playlistSheet.js", () => ({
  fetchSheetCsv: vi.fn().mockResolvedValue("csv"),
  parseSheet: vi.fn(),
  getCellA1: vi.fn(),
}));

vi.mock("../src/lib/googleSheetsWriter.js", () => ({
  writeCellImage: vi.fn(),
}));

vi.mock("../src/lib/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { db } = await import("../src/lib/db.js");
const { parseSheet, getCellA1 } = await import("../src/lib/playlistSheet.js");
const { writeCellImage } = await import("../src/lib/googleSheetsWriter.js");
const { logger } = await import("../src/lib/logger.js");
const { fillMissingEntries } = await import("../src/lib/playlistFrownFill.js");

describe("fillMissingEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCellA1).mockReturnValue("B5");
    vi.mocked(db.playlistFrownFill.findUnique).mockResolvedValue(null);
  });

  it("does nothing and reports skippedNoCredential when no key path is configured", async () => {
    const result = await fillMissingEntries("sheet-1", undefined, "http://img");

    expect(result).toEqual({ filled: [], skippedNoCredential: true });
    expect(parseSheet).not.toHaveBeenCalled();
  });

  it("fills a non-contributor's cell on a DONE week and records it", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" }, rowIndex: 4 }],
    });

    const result = await fillMissingEntries("sheet-1", "/key.json", "http://img/frown.png");

    expect(writeCellImage).toHaveBeenCalledWith(
      "/key.json",
      "sheet-1",
      "B5",
      "http://img/frown.png"
    );
    expect(db.playlistFrownFill.create).toHaveBeenCalledWith({
      data: { weekNumber: 1, person: "Sam" },
    });
    expect(result).toEqual({
      filled: [{ weekNumber: 1, person: "Sam" }],
      skippedNoCredential: false,
    });
  });

  it("skips a week that is not DONE", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [{ weekNumber: 1, status: "12 h left", entries: { Alex: "Song A" }, rowIndex: 4 }],
    });

    const result = await fillMissingEntries("sheet-1", "/key.json", "http://img");

    expect(writeCellImage).not.toHaveBeenCalled();
    expect(result.filled).toEqual([]);
  });

  it("does not re-fill a cell already recorded (idempotent across polls)", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" }, rowIndex: 4 }],
    });
    vi.mocked(db.playlistFrownFill.findUnique).mockResolvedValueOnce({
      weekNumber: 1,
      person: "Sam",
      filledAt: new Date(),
    });

    const result = await fillMissingEntries("sheet-1", "/key.json", "http://img");

    expect(writeCellImage).not.toHaveBeenCalled();
    expect(db.playlistFrownFill.create).not.toHaveBeenCalled();
    expect(result.filled).toEqual([]);
  });

  it("does not fill anyone who already contributed", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [
        { weekNumber: 1, status: "DONE", entries: { Alex: "Song A", Sam: "Song B" }, rowIndex: 4 },
      ],
    });

    const result = await fillMissingEntries("sheet-1", "/key.json", "http://img");

    expect(writeCellImage).not.toHaveBeenCalled();
    expect(result.filled).toEqual([]);
  });

  it("logs and continues (doesn't throw) when a single cell write fails", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam", "Jordan"],
      weeks: [
        {
          weekNumber: 1,
          status: "DONE",
          entries: { Alex: "Song A" },
          rowIndex: 4,
        },
      ],
    });
    vi.mocked(writeCellImage)
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce(undefined);

    const result = await fillMissingEntries("sheet-1", "/key.json", "http://img");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to frown-fill a non-contributor's cell",
      expect.objectContaining({ weekNumber: 1, person: "Sam" })
    );
    // Sam's write failed (not recorded/reported as filled), Jordan's succeeded.
    expect(db.playlistFrownFill.create).toHaveBeenCalledTimes(1);
    expect(db.playlistFrownFill.create).toHaveBeenCalledWith({
      data: { weekNumber: 1, person: "Jordan" },
    });
    expect(result.filled).toEqual([{ weekNumber: 1, person: "Jordan" }]);
  });
});
