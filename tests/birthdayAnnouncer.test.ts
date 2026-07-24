import type { Client } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/birthdays.js", () => ({
  findTodaysBirthdays: vi.fn(),
}));

const { findTodaysBirthdays } = await import("../src/lib/birthdays.js");
const { announceTodaysBirthdays } = await import("../src/lib/birthdayAnnouncer.js");

function fakeSendableChannel(send: ReturnType<typeof vi.fn>) {
  return {
    send,
    isTextBased: () => true,
    isSendable: () => true,
  };
}

function fakeClient(channel: unknown): Client {
  return {
    channels: { fetch: vi.fn().mockResolvedValue(channel) },
  } as unknown as Client;
}

describe("announceTodaysBirthdays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when there are no birthdays today", async () => {
    vi.mocked(findTodaysBirthdays).mockResolvedValueOnce([]);
    const client = fakeClient(fakeSendableChannel(vi.fn()));

    await announceTodaysBirthdays(client, "channel-1");

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("sends one message per birthday to the fetched channel", async () => {
    vi.mocked(findTodaysBirthdays).mockResolvedValueOnce([
      { userId: "user-1", month: 7, day: 10 },
      { userId: "user-2", month: 7, day: 10 },
    ]);
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient(fakeSendableChannel(send));

    await announceTodaysBirthdays(client, "channel-1");

    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.stringContaining("<@user-1>"));
    expect(send).toHaveBeenCalledWith(expect.stringContaining("<@user-2>"));
  });

  it("logs and skips if the channel isn't sendable", async () => {
    vi.mocked(findTodaysBirthdays).mockResolvedValueOnce([{ userId: "user-1", month: 7, day: 10 }]);
    const client = fakeClient(null);

    await expect(announceTodaysBirthdays(client, "channel-1")).resolves.toBeUndefined();
  });
});
