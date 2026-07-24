import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const validEnv = {
  DISCORD_TOKEN: "token-123",
  DISCORD_GUILD_ID: "guild-123",
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: "channel-123",
  PLAYLIST_SHEET_ID: "sheet-123",
};

describe("loadConfig", () => {
  it("returns a config object when all required vars are present", () => {
    expect(loadConfig(validEnv)).toEqual({
      discordToken: "token-123",
      guildId: "guild-123",
      announcementsChannelId: "channel-123",
      playlistSheetId: "sheet-123",
    });
  });

  it("throws listing every missing variable", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: "token-123" })).toThrow(
      "Missing required environment variable(s): DISCORD_GUILD_ID, DISCORD_ANNOUNCEMENTS_CHANNEL_ID, PLAYLIST_SHEET_ID"
    );
  });

  it("throws when no env vars are present at all", () => {
    expect(() => loadConfig({})).toThrow(/Missing required environment variable/);
  });
});
