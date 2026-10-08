import type { ChatInputCommandInteraction } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { command } from "../../src/commands/idea.js";
import { UNAVAILABLE } from "../../src/lib/stTools.js";

const ENV = {
  DISCORD_TOKEN: "t",
  DISCORD_GUILD_ID: "g",
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: "c",
  PLAYLIST_SHEET_ID: "p",
  ST_TOOLS_URL: "https://hub.test",
  BOT_API_SECRET: "s3cret",
};

function chat(member: unknown) {
  return {
    user: { id: "42", displayName: "Global Name" },
    member,
    options: {
      getString: vi.fn((name: string) => (name === "title" ? "Board games" : null)),
    },
    channelId: "ideas-1",
    deferReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction & {
    editReply: ReturnType<typeof vi.fn>;
    deleteReply: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("idea command", () => {
  it("posts the idea with the server nickname and shows the returned embed", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const message = { embeds: [{ title: "Board games" }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, message }) });
    vi.stubGlobal("fetch", fetchMock);
    const i = chat({ displayName: "Nick" });
    await command.execute(i);
    expect(
      JSON.parse(
        (fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }])[1]
          .body
      )
    ).toEqual({
      title: "Board games",
      details: null,
      discordId: "42",
      name: "Nick",
    });
    expect(i.editReply).toHaveBeenCalledWith(message);
  });

  it("falls back to the user display name and the unavailable embed", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const i = chat(null);
    await command.execute(i);
    expect(
      JSON.parse(
        (fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }])[1]
          .body
      ).name
    ).toBe("Global Name");
    expect(i.editReply).toHaveBeenCalledWith(UNAVAILABLE);
  });

  it.each([
    ["posted in this channel", { posted: true, channelId: "ideas-1" }, true],
    ["posted in another channel", { posted: true, channelId: "other" }, false],
    ["not posted", { posted: false, channelId: null }, false],
  ])("%s: deletes the private reply only when it duplicates the post", async (_n, extra, drops) => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const message = { embeds: [{ title: "Board games" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, message, ...extra }) })
    );
    const i = chat(null);
    await command.execute(i);
    expect(i.deleteReply).toHaveBeenCalledTimes(drops ? 1 : 0);
    expect(i.editReply).toHaveBeenCalledTimes(drops ? 0 : 1);
  });
});
