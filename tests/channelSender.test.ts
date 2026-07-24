import type { Client, EmbedBuilder } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmbedsToChannel, sendToChannel } from "../src/lib/channelSender.js";

function fakeClient(channel: unknown): Client {
  return { channels: { fetch: vi.fn().mockResolvedValue(channel) } } as unknown as Client;
}

describe("sendToChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the message when the channel is sendable", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ send, isTextBased: () => true, isSendable: () => true });

    await sendToChannel(client, "channel-1", "hello");

    expect(send).toHaveBeenCalledWith("hello");
  });

  it("does nothing when the channel isn't text-based", async () => {
    const client = fakeClient({ isTextBased: () => false });
    await expect(sendToChannel(client, "channel-1", "hello")).resolves.toBeUndefined();
  });

  it("does nothing when the channel is text-based but not sendable", async () => {
    const client = fakeClient({ isTextBased: () => true, isSendable: () => false });
    await expect(sendToChannel(client, "channel-1", "hello")).resolves.toBeUndefined();
  });

  it("does nothing when the channel fetch returns null", async () => {
    const client = fakeClient(null);
    await expect(sendToChannel(client, "channel-1", "hello")).resolves.toBeUndefined();
  });
});

describe("sendEmbedsToChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const embeds = [{ toJSON: () => ({}) }] as unknown as EmbedBuilder[];

  it("sends embeds with optional content when the channel is sendable", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ send, isTextBased: () => true, isSendable: () => true });

    await sendEmbedsToChannel(client, "channel-1", embeds, "heads up");

    expect(send).toHaveBeenCalledWith({ content: "heads up", embeds });
  });

  it("sends embeds with no content when none is given", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ send, isTextBased: () => true, isSendable: () => true });

    await sendEmbedsToChannel(client, "channel-1", embeds);

    expect(send).toHaveBeenCalledWith({ content: undefined, embeds });
  });

  it("does nothing when the channel isn't sendable", async () => {
    const client = fakeClient({ isTextBased: () => true, isSendable: () => false });
    await expect(sendEmbedsToChannel(client, "channel-1", embeds)).resolves.toBeUndefined();
  });
});
