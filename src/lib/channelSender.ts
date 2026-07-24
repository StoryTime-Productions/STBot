import type { Client, EmbedBuilder, SendableChannels } from "discord.js";
import { logger } from "./logger.js";

async function resolveSendableChannel(
  client: Client,
  channelId: string
): Promise<SendableChannels | null> {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) {
    logger.error("Channel is not a sendable text channel", { channelId });
    return null;
  }

  return channel;
}

export async function sendToChannel(
  client: Client,
  channelId: string,
  message: string
): Promise<void> {
  const channel = await resolveSendableChannel(client, channelId);
  if (!channel) {
    return;
  }

  await channel.send(message);
}

export async function sendEmbedsToChannel(
  client: Client,
  channelId: string,
  embeds: EmbedBuilder[],
  content?: string
): Promise<void> {
  const channel = await resolveSendableChannel(client, channelId);
  if (!channel) {
    return;
  }

  await channel.send({ content, embeds });
}
