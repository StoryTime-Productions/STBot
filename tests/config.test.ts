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
      googleServiceAccountKeyPath: undefined,
      frownImageUrl: "https://i.imgflip.com/39sjn7.png",
      stToolsUrl: undefined,
      botApiSecret: undefined,
    });
  });

  it("picks up the st-tools URL (trailing slash trimmed) and secret", () => {
    const config = loadConfig({
      ...validEnv,
      ST_TOOLS_URL: "https://hub.test/",
      BOT_API_SECRET: "s3cret",
    });
    expect(config.stToolsUrl).toBe("https://hub.test");
    expect(config.botApiSecret).toBe("s3cret");
  });

  it("leaves the frown-fill feature disabled (no credential) when GOOGLE_SERVICE_ACCOUNT_KEY_PATH is unset", () => {
    expect(loadConfig(validEnv).googleServiceAccountKeyPath).toBeUndefined();
  });

  it("picks up GOOGLE_SERVICE_ACCOUNT_KEY_PATH and FROWN_IMAGE_URL when set", () => {
    const config = loadConfig({
      ...validEnv,
      GOOGLE_SERVICE_ACCOUNT_KEY_PATH: "/secrets/key.json",
      FROWN_IMAGE_URL: "https://example.com/custom-frown.png",
    });
    expect(config.googleServiceAccountKeyPath).toBe("/secrets/key.json");
    expect(config.frownImageUrl).toBe("https://example.com/custom-frown.png");
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
