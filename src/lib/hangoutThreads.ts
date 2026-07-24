import type { Client } from "discord.js";
import { logger } from "./logger.js";

export async function announceHangoutWithThread(
  client: Client,
  channelId: string,
  announcementText: string,
  threadName: string
): Promise<string | null> {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable() || !("threads" in channel)) {
    logger.error("Channel doesn't support announcements + threads", { channelId });
    return null;
  }

  const message = await channel.send(announcementText);
  const thread = await channel.threads.create({ name: threadName, startMessage: message.id });
  await thread.send("Discuss the hangout here! 🎉");
  return thread.id;
}
