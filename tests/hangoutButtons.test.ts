import type { ButtonInteraction } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleHangoutButton } from "../src/lib/hangoutButtons.js";
import { UNAVAILABLE } from "../src/lib/stTools.js";

const config = {
  discordToken: "t",
  guildId: "g",
  announcementsChannelId: "c",
  playlistSheetId: "p",
  googleServiceAccountKeyPath: undefined,
  frownImageUrl: "x",
  stToolsUrl: "https://hub.test",
  botApiSecret: "s3cret",
};
const ID = "123e4567-e89b-12d3-a456-426614174000";

function button(customId: string) {
  return {
    customId,
    user: { id: "42" },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ButtonInteraction & {
    deferReply: ReturnType<typeof vi.fn>;
    editReply: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("handleHangoutButton", () => {
  it("ignores buttons that are not hub buttons", async () => {
    const i = button("other:thing");
    expect(await handleHangoutButton(i, config)).toBe(false);
    expect(i.deferReply).not.toHaveBeenCalled();
  });

  it("sends the click to st-tools and replies ephemerally with its embed", async () => {
    const message = { embeds: [{ title: "You're going" }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, message }) });
    vi.stubGlobal("fetch", fetchMock);
    const i = button(`hangout:${ID}:not_going`);
    expect(await handleHangoutButton(i, config)).toBe(true);
    expect(
      JSON.parse(
        (fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }])[1]
          .body
      )
    ).toEqual({
      hangoutId: ID,
      discordId: "42",
      status: "not_going",
    });
    expect(i.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(i.editReply).toHaveBeenCalledWith(message);
  });

  it("replies with the unavailable embed when st-tools is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const i = button(`hangout:${ID}:going`);
    await handleHangoutButton(i, config);
    expect(i.editReply).toHaveBeenCalledWith(UNAVAILABLE);
  });
});
