import type { ChatInputCommandInteraction } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({ playlistSheetId: "sheet-1" }),
}));

vi.mock("../../src/lib/playlistSheet.js", () => ({
  fetchSheetCsv: vi.fn().mockResolvedValue("csv"),
  parseSheet: vi.fn(),
  getSheetUrl: vi.fn((sheetId: string) => `https://docs.google.com/spreadsheets/d/${sheetId}/edit`),
}));

const { parseSheet } = await import("../../src/lib/playlistSheet.js");
const { command } = await import("../../src/commands/playlist.js");

function fakeInteraction(): ChatInputCommandInteraction {
  return { reply: vi.fn().mockResolvedValue(undefined) } as unknown as ChatInputCommandInteraction;
}

describe("playlist stats command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts total entries and per-person contributions", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex", "Sam"],
      weeks: [
        { weekNumber: 1, status: "DONE", entries: { Alex: "Song A", Sam: "Song B" } },
        { weekNumber: 2, status: "12 h left", entries: { Alex: "Song C" } },
        { weekNumber: 3, status: "NOT STARTED YET", entries: {} },
      ],
    });

    const interaction = fakeInteraction();
    await command.execute(interaction);

    const reply = vi.mocked(interaction.reply).mock.calls[0]?.[0] as string;
    expect(reply).toContain("Total entries: 3");
    expect(reply).toContain("Alex: 2");
    expect(reply).toContain("Sam: 1");
    expect(reply).toContain("Current week: Week 2 (12 h left)");
    expect(reply).toContain("Spreadsheet: https://docs.google.com/spreadsheets/d/sheet-1/edit");
    expect(reply).toContain(
      "Spotify playlist: https://open.spotify.com/playlist/1WhzLDkFOghEZTqjDwYhJ4"
    );
  });

  it("reports all weeks complete when nothing is in progress", async () => {
    vi.mocked(parseSheet).mockReturnValueOnce({
      people: ["Alex"],
      weeks: [{ weekNumber: 1, status: "DONE", entries: { Alex: "Song A" } }],
    });

    const interaction = fakeInteraction();
    await command.execute(interaction);

    const reply = vi.mocked(interaction.reply).mock.calls[0]?.[0] as string;
    expect(reply).toContain("All templated weeks are complete!");
  });
});
