import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REST } from "discord.js";
import cron from "node-cron";
import { createClient } from "./client.js";
import { loadConfig } from "./config.js";
import { db } from "./lib/db.js";
import { loadCommands, registerCommands } from "./lib/commands.js";
import { announceTodaysBirthdays } from "./lib/birthdayAnnouncer.js";
import { syncBirthdaysInBackground } from "./lib/birthdaySync.js";
import { announcePlaylistUpdates, announceWeeklySummary } from "./lib/playlistAnnouncer.js";
import { getCurrentWeekSummary, pollPlaylistSheet } from "./lib/playlistTracker.js";
import { fillMissingEntries } from "./lib/playlistFrownFill.js";
import { checkInactiveHangouts } from "./lib/hangoutInactivity.js";
import { handleHangoutPingReaction } from "./lib/hangoutReactions.js";
import { handleHangoutButton } from "./lib/hangoutButtons.js";
import {
  MessageCounter,
  handleVoiceStateUpdate,
  handleWordleMessage,
  sendVoiceSnapshot,
} from "./lib/discordStats.js";
import { tickStTools } from "./lib/stTools.js";
import { logger } from "./lib/logger.js";
import type { Command } from "./types.js";

const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "commands");

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createClient();
  const commands = await loadCommands(commandsDir);
  const messageCounter = new MessageCounter();

  client.once("clientReady", (readyClient) => {
    logger.info("Bot logged in", { tag: readyClient.user.tag });

    const rest = new REST().setToken(config.discordToken);
    registerCommands(rest, readyClient.application.id, config.guildId, commands)
      .then(() => logger.info("Registered guild commands", { count: commands.size }))
      .catch((error: unknown) =>
        logger.error("Failed to register commands", { error: String(error) })
      );

    cron.schedule(
      "0 0 * * *",
      () => {
        announceTodaysBirthdays(readyClient, config.announcementsChannelId).catch(
          (error: unknown) =>
            logger.error("Birthday announcement job failed", { error: String(error) })
        );
        // Daily refresh so names and avatars on the dashboard stay current.
        syncBirthdaysInBackground(readyClient.guilds.cache.get(config.guildId) ?? null, config);
      },
      { timezone: "America/Toronto" }
    );

    cron.schedule("*/30 * * * *", () => {
      pollPlaylistSheet(config.playlistSheetId)
        .then((result) =>
          announcePlaylistUpdates(readyClient, config.announcementsChannelId, result)
        )
        .catch((error: unknown) =>
          logger.error("Playlist sheet poll failed", { error: String(error) })
        );
    });

    cron.schedule("*/30 * * * *", () => {
      fillMissingEntries(
        config.playlistSheetId,
        config.googleServiceAccountKeyPath,
        config.frownImageUrl
      ).catch((error: unknown) =>
        logger.error("Playlist frown-fill failed", { error: String(error) })
      );
    });

    cron.schedule(
      "0 0 * * 1",
      () => {
        getCurrentWeekSummary(config.playlistSheetId)
          .then((week) => announceWeeklySummary(readyClient, config.announcementsChannelId, week))
          .catch((error: unknown) =>
            logger.error("Weekly playlist summary job failed", { error: String(error) })
          );
      },
      { timezone: "America/Toronto" }
    );

    cron.schedule("* * * * *", () => {
      tickStTools(config).catch((error: unknown) =>
        logger.error("st-tools tick failed", { error: String(error) })
      );
      messageCounter
        .flush(config)
        .catch((error: unknown) =>
          logger.error("Message count flush failed", { error: String(error) })
        );
    });

    // Close voice sessions that ended while the bot was down and open the ones in progress.
    const guild = readyClient.guilds.cache.get(config.guildId);
    if (guild) {
      sendVoiceSnapshot(guild, config).catch((error: unknown) =>
        logger.error("Voice snapshot failed", { error: String(error) })
      );
      syncBirthdaysInBackground(guild, config);
    }

    cron.schedule("0 11 * * *", () => {
      checkInactiveHangouts(readyClient, 14).catch((error: unknown) =>
        logger.error("Hangout inactivity check failed", { error: String(error) })
      );
    });
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.guild.id !== config.guildId) {
      return;
    }

    handleVoiceStateUpdate(oldState, newState, config).catch((error: unknown) =>
      logger.error("Voice state handling failed", { error: String(error) })
    );
  });

  client.on("messageCreate", (message) => {
    if (message.guildId !== config.guildId) {
      return;
    }

    messageCounter.record(message, config);
    handleWordleMessage(message, config).catch((error: unknown) =>
      logger.error("Wordle streak handling failed", { error: String(error) })
    );
  });

  client.on("messageReactionAdd", (reaction, user) => {
    if (user.bot) {
      return;
    }

    handleHangoutPingReaction(reaction.message.id, reaction.emoji.name ?? "").catch(
      (error: unknown) =>
        logger.error("Hangout ping reaction handling failed", { error: String(error) })
    );
  });

  client.on("interactionCreate", (interaction) => {
    if (interaction.isButton()) {
      handleHangoutButton(interaction, config).catch((error: unknown) =>
        logger.error("Hangout button handling failed", { error: String(error) })
      );
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command: Command | undefined = commands.get(interaction.commandName);
    if (!command) {
      logger.warn("Received unknown command", { name: interaction.commandName });
      return;
    }

    command.execute(interaction).catch((error: unknown) => {
      logger.error("Command execution failed", {
        name: interaction.commandName,
        error: String(error),
      });
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Shutting down", { signal });
    await messageCounter.flush(config).catch(() => undefined);
    client.destroy();
    await db.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await client.login(config.discordToken);
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error", { error: String(error) });
  process.exit(1);
});
