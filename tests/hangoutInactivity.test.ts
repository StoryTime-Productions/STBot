import { type Client, SnowflakeUtil } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/hangouts.js", () => ({
  listHangoutsWithThreads: vi.fn(),
  recordInactivityPing: vi.fn(),
}));

const { listHangoutsWithThreads, recordInactivityPing } = await import("../src/lib/hangouts.js");
const { checkInactiveHangouts } = await import("../src/lib/hangoutInactivity.js");

function snowflakeAt(date: Date): string {
  return SnowflakeUtil.generate({ timestamp: date }).toString();
}

function fakeThreadChannel(opts: {
  lastMessageId?: string | null;
  createdTimestamp?: number;
  react?: ReturnType<typeof vi.fn>;
  send?: ReturnType<typeof vi.fn>;
}) {
  const react = opts.react ?? vi.fn().mockResolvedValue(undefined);
  const send = opts.send ?? vi.fn().mockResolvedValue({ id: "ping-msg-1", react });
  return {
    isThread: () => true,
    isSendable: () => true,
    lastMessageId: opts.lastMessageId ?? null,
    createdTimestamp: opts.createdTimestamp ?? Date.now(),
    send,
  };
}

function fakeClient(channel: unknown): Client {
  return { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as unknown as Client;
}

describe("checkInactiveHangouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pings a thread whose last message is older than the threshold", async () => {
    const oldSnowflake = snowflakeAt(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000));
    vi.mocked(listHangoutsWithThreads).mockResolvedValueOnce([
      {
        id: 1,
        title: "Board game night",
        proposedBy: "user-1",
        stage: "proposed",
        when2meetUrl: null,
        lockedAt: null,
        logistics: null,
        threadId: "thread-1",
        pingMessageId: null,
        lastPingedAt: null,
        archived: false,
      },
    ]);
    const channel = fakeThreadChannel({ lastMessageId: oldSnowflake });
    const client = fakeClient(channel);

    await checkInactiveHangouts(client, 14);

    expect(channel.send).toHaveBeenCalledWith(expect.stringContaining("Board game night"));
    expect(recordInactivityPing).toHaveBeenCalledWith(1, "ping-msg-1", expect.any(Date));
  });

  it("does not ping a thread that's been active within the threshold", async () => {
    const recentSnowflake = snowflakeAt(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000));
    vi.mocked(listHangoutsWithThreads).mockResolvedValueOnce([
      {
        id: 1,
        title: "Board game night",
        proposedBy: "user-1",
        stage: "proposed",
        when2meetUrl: null,
        lockedAt: null,
        logistics: null,
        threadId: "thread-1",
        pingMessageId: null,
        lastPingedAt: null,
        archived: false,
      },
    ]);
    const channel = fakeThreadChannel({ lastMessageId: recentSnowflake });
    const client = fakeClient(channel);

    await checkInactiveHangouts(client, 14);

    expect(channel.send).not.toHaveBeenCalled();
    expect(recordInactivityPing).not.toHaveBeenCalled();
  });

  it("does not re-ping if already pinged since the last activity", async () => {
    const oldSnowflake = snowflakeAt(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000));
    vi.mocked(listHangoutsWithThreads).mockResolvedValueOnce([
      {
        id: 1,
        title: "Board game night",
        proposedBy: "user-1",
        stage: "proposed",
        when2meetUrl: null,
        lockedAt: null,
        logistics: null,
        threadId: "thread-1",
        pingMessageId: "existing-ping",
        lastPingedAt: new Date(), // pinged just now, after the last activity
        archived: false,
      },
    ]);
    const channel = fakeThreadChannel({ lastMessageId: oldSnowflake });
    const client = fakeClient(channel);

    await checkInactiveHangouts(client, 14);

    expect(channel.send).not.toHaveBeenCalled();
  });

  it("skips events whose thread channel can't be fetched", async () => {
    vi.mocked(listHangoutsWithThreads).mockResolvedValueOnce([
      {
        id: 1,
        title: "Board game night",
        proposedBy: "user-1",
        stage: "proposed",
        when2meetUrl: null,
        lockedAt: null,
        logistics: null,
        threadId: "thread-1",
        pingMessageId: null,
        lastPingedAt: null,
        archived: false,
      },
    ]);
    const client = {
      channels: { fetch: vi.fn().mockRejectedValue(new Error("unknown channel")) },
    } as unknown as Client;

    await expect(checkInactiveHangouts(client, 14)).resolves.toBeUndefined();
    expect(recordInactivityPing).not.toHaveBeenCalled();
  });
});
