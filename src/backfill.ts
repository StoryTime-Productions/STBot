import "dotenv/config";
import { REST } from "discord.js";
import { loadConfig } from "./config.js";
import { collectMessageCounts } from "./lib/discordBackfill.js";
import { statsEnabled } from "./lib/discordStats.js";
import { logger } from "./lib/logger.js";
import { callStTools } from "./lib/stTools.js";

const BATCH = 500;

/**
 * One-off: counts the last year of chat messages (whole days before today) and sends them to
 * st-tools in "set" mode, so running it again is safe. Run inside the bot container:
 *   node dist/backfill.js          # send
 *   node dist/backfill.js --dry    # only print what would be sent
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const dry = process.argv.includes("--dry");
  if (!dry && !statsEnabled(config)) {
    throw new Error("ST_TOOLS_URL and BOT_API_SECRET must be set to send counts");
  }

  const rest = new REST().setToken(config.discordToken);
  const { entries, channels, messages } = await collectMessageCounts({
    rest,
    guildId: config.guildId,
    chatCategoryId: config.chatCategoryId,
  });
  logger.info("Backfill ready", { channels, messages, rows: entries.length, dry });
  if (dry) return;

  for (let start = 0; start < entries.length; start += BATCH) {
    const answer = await callStTools(config, "discord/messages", {
      mode: "set",
      entries: entries.slice(start, start + BATCH),
    });
    if (answer === null) throw new Error(`st-tools rejected the batch starting at ${start}`);
  }
  logger.info("Backfill sent", { rows: entries.length });
}

main().catch((error: unknown) => {
  logger.error("Backfill failed", { error: String(error) });
  process.exit(1);
});
