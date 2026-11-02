import type { Guild } from "discord.js";
import type { BotConfig } from "../config.js";
import { listBirthdays } from "./birthdays.js";
import { logger } from "./logger.js";
import { statsEnabled } from "./discordStats.js";
import { callStTools } from "./stTools.js";

/**
 * Pushes the stored birthdays, with each member's current name and avatar, to st-tools, which
 * replaces its copy with this list. Members who left the server are skipped. No-op when the
 * st-tools link is not configured.
 */
export async function syncBirthdays(
  guild: Guild,
  config: Pick<BotConfig, "stToolsUrl" | "botApiSecret">
): Promise<void> {
  if (!statsEnabled(config)) return;

  const stored = await listBirthdays();
  const birthdays = [];
  for (const birthday of stored) {
    const member = await guild.members.fetch(birthday.userId).catch(() => null);
    if (!member) {
      logger.warn("Skipping a birthday for a member who is not in the server", {
        userId: birthday.userId,
      });
      continue;
    }
    birthdays.push({
      discordId: member.id,
      name: member.displayName,
      avatarUrl: member.displayAvatarURL({ extension: "png", size: 64 }),
      month: birthday.month,
      day: birthday.day,
    });
  }

  await callStTools(config, "discord/birthdays", { birthdays });
}

/** Fire and forget: a sync failure must never break the command or job that triggered it. */
export function syncBirthdaysInBackground(
  guild: Guild | null,
  config: Pick<BotConfig, "stToolsUrl" | "botApiSecret">
): void {
  if (!guild) return;
  syncBirthdays(guild, config).catch((error: unknown) =>
    logger.error("Birthday sync failed", { error: String(error) })
  );
}
