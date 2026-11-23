import type { Client } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { announcePlaylistUpdates, announceWeeklySummary } from "../src/lib/playlistAnnouncer.js";
import {
  markEntriesSeen,
  type CurrentWeekSummary,
  type PollResult,
} from "../src/lib/playlistTracker.js";
import { lookupSong } from "../src/lib/musicLookup.js";

vi.mock("../src/lib/musicLookup.js", () => ({
  lookupSong: vi.fn(),
}));

vi.mock("../src/lib/playlistTracker.js", () => ({
  markEntriesSeen: vi.fn().mockResolvedValue(undefined),
}));

function fakeSendableChannel(send: ReturnType<typeof vi.fn>) {
  return { send, isTextBased: () => true, isSendable: () => true };
}

function fakeClient(channel: unknown): Client {
  return { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as unknown as Client;
}

describe("announcePlaylistUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupSong).mockResolvedValue(null);
  });

  it("does nothing when there's nothing new", async () => {
    const client = fakeClient(fakeSendableChannel(vi.fn()));
    const result: PollResult = { newEntries: [], completedWeeks: [] };

    await announcePlaylistUpdates(client, "channel-1", result);

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("announces each new entry (as an embed) and each completed week (as a digest)", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));
    const result: PollResult = {
      newEntries: [{ weekNumber: 2, person: "Alex", entry: "Song A" }],
      completedWeeks: [
        { weekNumber: 1, entries: { Alex: "Song A" }, contributorCount: 1, totalPeople: 2 },
      ],
    };

    await announcePlaylistUpdates(client, "channel-1", result);

    expect(send).toHaveBeenCalledTimes(2);

    const newEntryCall = send.mock.calls[0]?.[0];
    expect(newEntryCall.content).toContain("New entry for Week 2");
    expect(newEntryCall.embeds).toHaveLength(1);
    expect(newEntryCall.embeds[0].data.author.name).toBe("Alex");

    const weekCompleteCall = send.mock.calls[1]?.[0];
    expect(weekCompleteCall.content).toContain("Week complete!");
    expect(weekCompleteCall.content).toContain("Week 1");
    expect(weekCompleteCall.embeds).toHaveLength(1);
  });

  it("does not announce entries one by one for a week whose digest is posted", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));
    const result: PollResult = {
      newEntries: [
        { weekNumber: 1, person: "Alex", entry: "Song A" },
        { weekNumber: 2, person: "Sam", entry: "Song B" },
      ],
      completedWeeks: [
        { weekNumber: 1, entries: { Alex: "Song A" }, contributorCount: 1, totalPeople: 2 },
      ],
    };

    await announcePlaylistUpdates(client, "channel-1", result);

    const contents = send.mock.calls.map((call) => call[0].content as string);
    expect(contents).toHaveLength(2);
    expect(contents[0]).toContain("New entry for Week 2");
    expect(contents[1]).toContain("Week complete!");
    expect(contents.join("\n")).not.toContain("New entry for Week 1");
  });

  it("logs and skips if the channel isn't sendable", async () => {
    const client = fakeClient(null);
    const result: PollResult = {
      newEntries: [{ weekNumber: 1, person: "Alex", entry: "Song A" }],
      completedWeeks: [],
    };

    await expect(announcePlaylistUpdates(client, "channel-1", result)).resolves.toBeUndefined();
  });
});

describe("announceWeeklySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupSong).mockResolvedValue(null);
  });

  it("announces the current week's contributions as embeds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));
    const week: CurrentWeekSummary = {
      weekNumber: 2,
      status: "12 h left",
      entries: { Alex: "Song C" },
      contributorCount: 1,
      totalPeople: 2,
    };

    await announceWeeklySummary(client, "channel-1", week);

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0];
    expect(call.content).toContain("Week 2");
    expect(call.content).toContain("12 h left");
    expect(call.embeds).toHaveLength(1);
    expect(call.embeds[0].data.author.name).toBe("Alex");
  });

  it("marks the listed entries as seen so the next poll does not repeat them", async () => {
    const client = fakeClient(fakeSendableChannel(vi.fn().mockResolvedValue(undefined)));
    const week: CurrentWeekSummary = {
      weekNumber: 21,
      status: "1 h left",
      entries: { Denmar: "Song D" },
      contributorCount: 1,
      totalPeople: 12,
    };

    await announceWeeklySummary(client, "channel-1", week);

    expect(markEntriesSeen).toHaveBeenCalledWith(week);
  });

  it("does not touch the stored entries when there is no current week", async () => {
    const client = fakeClient(fakeSendableChannel(vi.fn().mockResolvedValue(undefined)));

    await announceWeeklySummary(client, "channel-1", undefined);

    expect(markEntriesSeen).not.toHaveBeenCalled();
  });

  it("announces that all weeks are complete when there's no current week", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));

    await announceWeeklySummary(client, "channel-1", undefined);

    expect(send).toHaveBeenCalledWith(expect.stringContaining("all templated weeks are complete"));
  });

  it("says 'no entries yet' when the current week has no contributions, without calling lookupSong", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));
    const week: CurrentWeekSummary = {
      weekNumber: 4,
      status: "NOT STARTED YET",
      entries: {},
      contributorCount: 0,
      totalPeople: 2,
    };

    await announceWeeklySummary(client, "channel-1", week);

    expect(lookupSong).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.stringContaining("No entries yet."));
  });
});
