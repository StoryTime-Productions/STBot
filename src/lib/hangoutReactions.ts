import { archiveHangoutByPing, keepHangoutActive } from "./hangouts.js";
import { KEEP_EMOJI, PURGE_EMOJI } from "./hangoutInactivity.js";

export async function handleHangoutPingReaction(
  messageId: string,
  emojiName: string
): Promise<void> {
  if (emojiName === KEEP_EMOJI) {
    await keepHangoutActive(messageId);
  } else if (emojiName === PURGE_EMOJI) {
    await archiveHangoutByPing(messageId);
  }
}
