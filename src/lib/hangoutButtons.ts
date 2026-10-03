import { MessageFlags, type ButtonInteraction } from "discord.js";
import type { BotConfig } from "../config.js";
import { messageFromStTools } from "./stTools.js";

const CUSTOM_ID = /^hangout:([0-9a-f-]{36}):(going|maybe|not_going)$/;

/** Handles a hub Going / Maybe / Not going button; returns false when it is not one of ours. */
export async function handleHangoutButton(
  interaction: ButtonInteraction,
  config: BotConfig
): Promise<boolean> {
  const match = CUSTOM_ID.exec(interaction.customId);
  if (!match) {
    return false;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const message = await messageFromStTools(config, "attendance", {
    hangoutId: match[1],
    discordId: interaction.user.id,
    status: match[2],
  });
  await interaction.editReply(message as Parameters<ButtonInteraction["editReply"]>[0]);
  return true;
}
