import { type Client, SnowflakeUtil } from "discord.js";
import { listHangoutsWithThreads, recordInactivityPing } from "./hangouts.js";
import { logger } from "./logger.js";

export const KEEP_EMOJI = "✅";
export const PURGE_EMOJI = "🗑️";

export async function checkInactiveHangouts(client: Client, thresholdDays = 14): Promise<void> {
  const cutoffMs = thresholdDays * 24 * 60 * 60 * 1000;
  const events = await listHangoutsWithThreads();

  for (const event of events) {
    if (!event.threadId) {
      continue;
    }

    const channel = await client.channels.fetch(event.threadId).catch(() => null);
    if (!channel?.isThread() || !channel.isSendable()) {
      continue;
    }

    const lastActivity = channel.lastMessageId
      ? SnowflakeUtil.timestampFrom(channel.lastMessageId)
      : channel.createdTimestamp;

    if (lastActivity === null || Date.now() - lastActivity < cutoffMs) {
      continue;
    }

    const alreadyPingedSinceThen =
      event.lastPingedAt !== null && event.lastPingedAt.getTime() >= lastActivity;
    if (alreadyPingedSinceThen) {
      continue;
    }

    const pingMessage = await channel.send(
      `👋 This hangout thread has been quiet for a while. Is **${event.title}** still happening? React ${KEEP_EMOJI} to keep it, ${PURGE_EMOJI} to archive it.`
    );
    await pingMessage.react(KEEP_EMOJI);
    await pingMessage.react(PURGE_EMOJI);

    await recordInactivityPing(event.id, pingMessage.id, new Date());
    logger.info("Pinged inactive hangout thread", {
      hangoutId: event.id,
      threadId: event.threadId,
    });
  }
}
