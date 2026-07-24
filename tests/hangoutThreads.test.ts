import type { Client } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { announceHangoutWithThread } from "../src/lib/hangoutThreads.js";

function fakeThreadCapableChannel(
  send: ReturnType<typeof vi.fn>,
  createThread: ReturnType<typeof vi.fn>
) {
  return {
    send,
    isTextBased: () => true,
    isSendable: () => true,
    threads: { create: createThread },
  };
}

function fakeClient(channel: unknown): Client {
  return { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as unknown as Client;
}

describe("announceHangoutWithThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the announcement and creates a thread attached to it", async () => {
    const send = vi.fn().mockResolvedValue({ id: "message-1" });
    const threadSend = vi.fn().mockResolvedValue(undefined);
    const createThread = vi.fn().mockResolvedValue({ id: "thread-1", send: threadSend });
    const client = fakeClient(fakeThreadCapableChannel(send, createThread));

    const threadId = await announceHangoutWithThread(
      client,
      "channel-1",
      "Announcement text",
      "My Hangout"
    );

    expect(send).toHaveBeenCalledWith("Announcement text");
    expect(createThread).toHaveBeenCalledWith({ name: "My Hangout", startMessage: "message-1" });
    expect(threadSend).toHaveBeenCalledOnce();
    expect(threadId).toBe("thread-1");
  });

  it("returns null when the channel isn't text-based", async () => {
    const client = fakeClient({ isTextBased: () => false });
    await expect(
      announceHangoutWithThread(client, "channel-1", "text", "name")
    ).resolves.toBeNull();
  });

  it("returns null when the channel has no threads manager", async () => {
    const client = fakeClient({ isTextBased: () => true, isSendable: () => true });
    await expect(
      announceHangoutWithThread(client, "channel-1", "text", "name")
    ).resolves.toBeNull();
  });
});
