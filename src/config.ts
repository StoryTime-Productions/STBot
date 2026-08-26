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
}

const REQUIRED_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_GUILD_ID",
  "DISCORD_ANNOUNCEMENTS_CHANNEL_ID",
  "PLAYLIST_SHEET_ID",
] as const;

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
  };
}
