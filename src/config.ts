const DEFAULT_FROWN_IMAGE_URL = "https://i.imgflip.com/39sjn7.png";

export interface BotConfig {
  discordToken: string;
  guildId: string;
  announcementsChannelId: string;
  playlistSheetId: string;
  /** Path to a Google service-account JSON key with Editor access to the
   * playlist sheet. Undefined means the frown-fill feature is disabled
   * (skipped with a one-time warning) rather than crashing the bot —
   * every other feature must keep working without this credential. */
  googleServiceAccountKeyPath: string | undefined;
  frownImageUrl: string;
  /** Base URL of st-tools. Both st-tools values must be set for the hub
   * buttons, /idea and the per-minute tick; unset disables just those. */
  stToolsUrl: string | undefined;
  botApiSecret: string | undefined;
  /** Discord stats shown on the st-tools dashboard (need the two st-tools values above). Messages
   * count in this category and its threads; matching by category id includes channels added later. */
  chatCategoryId: string;
  /** Voice time counts in these categories (Socializing and Studying by default), minus the
   * guild's AFK channel and the excluded ids. */
  voiceCategoryIds: string[];
  voiceExcludedChannelIds: string[];
  /** The channel the Wordle app posts its daily streak in; unset matches a channel named st-wordle. */
  wordleChannelId: string | undefined;
}

const DEFAULT_CHAT_CATEGORY_ID = "379790880787398677";
const DEFAULT_VOICE_CATEGORY_IDS = ["379789398734274563", "843558026799742996"];

const REQUIRED_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_GUILD_ID",
  "DISCORD_ANNOUNCEMENTS_CHANNEL_ID",
  "PLAYLIST_SHEET_ID",
] as const;

/** A comma-separated env list, trimmed and without blanks; the fallback when it is unset or empty. */
function listOf(value: string | undefined, fallback: string[]): string[] {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  return {
    discordToken: env["DISCORD_TOKEN"] as string,
    guildId: env["DISCORD_GUILD_ID"] as string,
    announcementsChannelId: env["DISCORD_ANNOUNCEMENTS_CHANNEL_ID"] as string,
    playlistSheetId: env["PLAYLIST_SHEET_ID"] as string,
    googleServiceAccountKeyPath: env["GOOGLE_SERVICE_ACCOUNT_KEY_PATH"] || undefined,
    frownImageUrl: env["FROWN_IMAGE_URL"] || DEFAULT_FROWN_IMAGE_URL,
    stToolsUrl: env["ST_TOOLS_URL"]?.replace(/\/+$/, "") || undefined,
    botApiSecret: env["BOT_API_SECRET"] || undefined,
    chatCategoryId: env["DISCORD_CHAT_CATEGORY_ID"] || DEFAULT_CHAT_CATEGORY_ID,
    voiceCategoryIds: listOf(env["DISCORD_VOICE_CATEGORY_IDS"], DEFAULT_VOICE_CATEGORY_IDS),
    voiceExcludedChannelIds: listOf(env["DISCORD_VOICE_EXCLUDED_CHANNEL_IDS"], []),
    wordleChannelId: env["DISCORD_WORDLE_CHANNEL_ID"] || undefined,
  };
}
