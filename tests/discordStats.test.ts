import type { Guild, Message, VoiceState } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callStTools = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/stTools.js", () => ({ callStTools }));

import {
  MessageCounter,
  handleVoiceStateUpdate,
  handleWordleMessage,
  isCountedVoiceChannel,
  parseWordleStreak,
  sendVoiceSnapshot,
  statsEnabled,
  torontoDay,
  type StatsConfig,
} from "../src/lib/discordStats.js";

const CONFIG: StatsConfig = {
  stToolsUrl: "https://hub.test",
  botApiSecret: "s3cret",
  chatCategoryId: "chat",
  voiceCategoryId: "voice",
  voiceExcludedChannelIds: ["gurls"],
  wordleChannelId: undefined,
};
const OFF: StatsConfig = { ...CONFIG, stToolsUrl: undefined };

const AFK = "afk";

function voiceChannel(id: string, name: string, parentId = "voice") {
  return { id, name, parentId, guild: { afkChannelId: AFK } };
}

function member(id: string, name: string, bot = false) {
  return {
    id,
    displayName: name,
    user: { bot },
    displayAvatarURL: () => `https://cdn.test/${id}.png`,
  };
}

function state(channel: ReturnType<typeof voiceChannel> | null, who = member("1", "Kiara")) {
  return { channel, channelId: channel?.id ?? null, member: who } as unknown as VoiceState;
}

function textMessage(
  overrides: {
    bot?: boolean;
    parentId?: string | null;
    thread?: { parentId: string | null } | null;
    content?: string;
    channelName?: string;
    channelId?: string;
    at?: Date;
    embeds?: Array<{ title?: string | null; description?: string | null }>;
    noMember?: boolean;
  } = {}
) {
  const container = {
    id: overrides.channelId ?? "c1",
    name: overrides.channelName ?? "st-general",
    parentId: overrides.parentId === undefined ? "chat" : overrides.parentId,
  };
  const thread = overrides.thread;
  const channel = thread
    ? {
        id: "t1",
        isThread: () => true,
        parent: thread.parentId === null ? null : { parentId: thread.parentId },
      }
    : { ...container, isThread: () => false };
  return {
    author: {
      id: "1",
      bot: overrides.bot ?? false,
      username: "kiara_p",
      globalName: "Kiara G",
      displayAvatarURL: () => "https://cdn.test/author.png",
    },
    member: overrides.noMember ? null : member("1", "Kiara"),
    channel,
    content: overrides.content ?? "hello",
    embeds: overrides.embeds ?? [],
    createdAt: overrides.at ?? new Date("2026-10-30T14:00:00Z"),
  } as unknown as Message;
}

interface Body {
  entries: Array<Record<string, unknown>>;
  streak?: number;
  type?: string;
  channelId?: string;
}

function bodyOf(call: number): Body {
  return callStTools.mock.calls[call]?.[2] as Body;
}

beforeEach(() => {
  callStTools.mockReset();
  callStTools.mockResolvedValue({ ok: true });
});

describe("helpers", () => {
  it("uses the Toronto calendar day, even late in the evening", () => {
    expect(torontoDay(new Date("2026-10-30T14:00:00Z"))).toBe("2026-10-30");
    expect(torontoDay(new Date("2026-10-31T01:30:00Z"))).toBe("2026-10-30");
  });

  it("needs both st-tools values", () => {
    expect(statsEnabled(CONFIG)).toBe(true);
    expect(statsEnabled(OFF)).toBe(false);
    expect(statsEnabled({ stToolsUrl: "x", botApiSecret: undefined })).toBe(false);
  });

  it("counts voice channels in the category, minus AFK and excluded ones", () => {
    expect(isCountedVoiceChannel(voiceChannel("v1", "D&D"), CONFIG)).toBe(true);
    expect(isCountedVoiceChannel(voiceChannel(AFK, "Nap Time"), CONFIG)).toBe(false);
    expect(isCountedVoiceChannel(voiceChannel("gurls", "gurls only"), CONFIG)).toBe(false);
    expect(isCountedVoiceChannel(voiceChannel("v2", "st-tudy", "studying"), CONFIG)).toBe(false);
    expect(isCountedVoiceChannel(null, CONFIG)).toBe(false);
  });

  it("reads the streak out of the Wordle post", () => {
    expect(
      parseWordleStreak("**Your group is on an 80 day streak!** Here are yesterday's results")
    ).toBe(80);
    expect(parseWordleStreak("on a 5-day streak")).toBe(5);
    expect(parseWordleStreak("no streak here")).toBeNull();
  });
});

describe("handleVoiceStateUpdate", () => {
  it("sends a join with name, avatar and channel when someone enters a counted channel", async () => {
    await handleVoiceStateUpdate(state(null), state(voiceChannel("v1", "D&D")), CONFIG);

    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/voice", {
      type: "join",
      discordId: "1",
      name: "Kiara",
      avatarUrl: "https://cdn.test/1.png",
      channelId: "v1",
      channelName: "D&D",
    });
  });

  it("sends a join when moving between counted channels, so the session is split", async () => {
    await handleVoiceStateUpdate(
      state(voiceChannel("v1", "D&D")),
      state(voiceChannel("v2", "Tsujiri 2.0")),
      CONFIG
    );

    expect(callStTools).toHaveBeenCalledTimes(1);
    expect(bodyOf(0)).toMatchObject({ type: "join", channelId: "v2" });
  });

  it("sends a leave on disconnect or when moving to an uncounted channel", async () => {
    await handleVoiceStateUpdate(state(voiceChannel("v1", "D&D")), state(null), CONFIG);
    await handleVoiceStateUpdate(
      state(voiceChannel("v1", "D&D")),
      state(voiceChannel(AFK, "Nap Time")),
      CONFIG
    );

    expect(callStTools).toHaveBeenNthCalledWith(1, CONFIG, "discord/voice", {
      type: "leave",
      discordId: "1",
    });
    expect(callStTools).toHaveBeenNthCalledWith(2, CONFIG, "discord/voice", {
      type: "leave",
      discordId: "1",
    });
  });

  it("ignores mute and stream changes, uncounted channels, bots, missing members and a disabled config", async () => {
    const same = voiceChannel("v1", "D&D");
    await handleVoiceStateUpdate(state(same), state(same), CONFIG);
    await handleVoiceStateUpdate(state(null), state(voiceChannel(AFK, "Nap Time")), CONFIG);
    await handleVoiceStateUpdate(state(null), state(same, member("2", "Bot", true)), CONFIG);
    await handleVoiceStateUpdate(state(null, null as never), state(same, null as never), CONFIG);
    await handleVoiceStateUpdate(state(null), state(same), OFF);

    expect(callStTools).not.toHaveBeenCalled();
  });

  it("falls back to the old state's member when the new one has none", async () => {
    const newState = {
      channel: voiceChannel("v1", "D&D"),
      channelId: "v1",
      member: null,
    } as unknown as VoiceState;
    await handleVoiceStateUpdate(state(null), newState, CONFIG);

    expect(callStTools).toHaveBeenCalledTimes(1);
  });
});

describe("sendVoiceSnapshot", () => {
  function guild(states: unknown[]) {
    return {
      voiceStates: { cache: new Map(states.map((s, i) => [String(i), s])) },
    } as unknown as Guild;
  }

  it("sends everyone in counted channels, leaving out bots and uncounted channels", async () => {
    await sendVoiceSnapshot(
      guild([
        state(voiceChannel("v1", "D&D"), member("1", "Kiara")),
        state(voiceChannel("v1", "D&D"), member("2", "Bot", true)),
        state(voiceChannel(AFK, "Nap Time"), member("3", "Denmar")),
        state(null, member("4", "Abisan")),
        { channel: voiceChannel("v1", "D&D"), member: null },
      ]),
      CONFIG
    );

    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/voice", {
      type: "snapshot",
      members: [
        {
          discordId: "1",
          name: "Kiara",
          avatarUrl: "https://cdn.test/1.png",
          channelId: "v1",
          channelName: "D&D",
        },
      ],
    });
  });

  it("sends an empty snapshot when nobody is on a call, and nothing when disabled", async () => {
    await sendVoiceSnapshot(guild([]), CONFIG);
    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/voice", {
      type: "snapshot",
      members: [],
    });

    callStTools.mockClear();
    await sendVoiceSnapshot(guild([]), OFF);
    expect(callStTools).not.toHaveBeenCalled();
  });
});

describe("MessageCounter", () => {
  it("counts human messages in the chat category per person per Toronto day", async () => {
    const counter = new MessageCounter();
    counter.record(textMessage(), CONFIG);
    counter.record(textMessage(), CONFIG);
    counter.record(textMessage({ at: new Date("2026-10-31T01:30:00Z") }), CONFIG);
    counter.record(textMessage({ at: new Date("2026-10-31T15:00:00Z") }), CONFIG);

    expect(counter.size).toBe(2);
    await counter.flush(CONFIG);

    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/messages", {
      mode: "add",
      entries: [
        {
          discordId: "1",
          name: "Kiara",
          day: "2026-10-30",
          count: 3,
          avatarUrl: "https://cdn.test/1.png",
        },
        {
          discordId: "1",
          name: "Kiara",
          day: "2026-10-31",
          count: 1,
          avatarUrl: "https://cdn.test/1.png",
        },
      ],
    });
    expect(counter.size).toBe(0);
  });

  it("counts messages in threads of chat channels, and skips bots, other categories and orphan threads", () => {
    const counter = new MessageCounter();
    counter.record(textMessage({ thread: { parentId: "chat" } }), CONFIG);
    counter.record(textMessage({ thread: { parentId: "games" } }), CONFIG);
    counter.record(textMessage({ thread: { parentId: null } }), CONFIG);
    counter.record(textMessage({ bot: true }), CONFIG);
    counter.record(textMessage({ parentId: "games" }), CONFIG);
    counter.record(textMessage({ parentId: null }), CONFIG);

    expect(counter.size).toBe(1);
  });

  it("falls back to the global or user name and the author's avatar when there is no server member", async () => {
    const counter = new MessageCounter();
    counter.record(textMessage({ noMember: true }), CONFIG);
    await counter.flush(CONFIG);

    expect(bodyOf(0).entries[0]).toMatchObject({
      name: "Kiara G",
      avatarUrl: "https://cdn.test/author.png",
    });
  });

  it("records nothing when st-tools is not configured", async () => {
    const counter = new MessageCounter();
    counter.record(textMessage(), OFF);
    await counter.flush(OFF);

    expect(counter.size).toBe(0);
    expect(callStTools).not.toHaveBeenCalled();
  });

  it("does nothing on an empty flush", async () => {
    await new MessageCounter().flush(CONFIG);
    expect(callStTools).not.toHaveBeenCalled();
  });

  it("keeps a batch st-tools did not accept and sends it with the next one", async () => {
    const counter = new MessageCounter();
    counter.record(textMessage(), CONFIG);
    callStTools.mockResolvedValueOnce(null);

    await counter.flush(CONFIG);
    expect(counter.size).toBe(1);

    counter.record(textMessage(), CONFIG);
    await counter.flush(CONFIG);

    expect(callStTools).toHaveBeenLastCalledWith(CONFIG, "discord/messages", {
      mode: "add",
      entries: [expect.objectContaining({ count: 2 })],
    });
    expect(counter.size).toBe(0);
  });

  it("sends at most 500 entries per request", async () => {
    const counter = new MessageCounter();
    for (let id = 1; id <= 501; id += 1) {
      const message = textMessage();
      (message.author as { id: string }).id = String(id);
      counter.record(message, CONFIG);
    }

    await counter.flush(CONFIG);

    expect(callStTools).toHaveBeenCalledTimes(2);
    expect(bodyOf(0).entries).toHaveLength(500);
    expect(bodyOf(1).entries).toHaveLength(1);
  });

  it("leaves the avatar out when there is none", async () => {
    const counter = new MessageCounter();
    const message = textMessage({ noMember: true });
    (message.author as unknown as { displayAvatarURL: () => string | null }).displayAvatarURL =
      () => null;
    counter.record(message, CONFIG);
    await counter.flush(CONFIG);

    expect(bodyOf(0).entries[0]).not.toHaveProperty("avatarUrl");
  });
});

describe("handleWordleMessage", () => {
  const POST = "**Your group is on an 80 day streak!** Here are yesterday's results:";

  it("sends the streak from the Wordle channel, dated in Toronto", async () => {
    await handleWordleMessage(
      textMessage({
        channelName: "st-wordle",
        content: POST,
        bot: true,
        at: new Date("2026-10-31T01:30:00Z"),
      }),
      CONFIG
    );

    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/wordle", {
      streak: 80,
      postedOn: "2026-10-30",
    });
  });

  it("also reads the streak from an embed", async () => {
    await handleWordleMessage(
      textMessage({
        channelName: "st-wordle",
        content: "",
        embeds: [{ title: null, description: "on a 12 day streak" }],
      }),
      CONFIG
    );

    expect(bodyOf(0).streak).toBe(12);
  });

  it("uses the configured channel id instead of the name when one is set", async () => {
    const pinned = { ...CONFIG, wordleChannelId: "w1" };
    await handleWordleMessage(textMessage({ channelName: "st-wordle", content: POST }), pinned);
    expect(callStTools).not.toHaveBeenCalled();

    await handleWordleMessage(
      textMessage({ channelName: "other", channelId: "w1", content: POST }),
      pinned
    );
    expect(callStTools).toHaveBeenCalledTimes(1);
  });

  it("ignores other channels, posts without a streak, threads without a name and a disabled config", async () => {
    await handleWordleMessage(textMessage({ channelName: "st-general", content: POST }), CONFIG);
    await handleWordleMessage(textMessage({ channelName: "st-wordle", content: "gg" }), CONFIG);
    await handleWordleMessage(textMessage({ thread: { parentId: "chat" }, content: POST }), CONFIG);
    await handleWordleMessage(textMessage({ channelName: "st-wordle", content: POST }), OFF);

    expect(callStTools).not.toHaveBeenCalled();
  });
});
