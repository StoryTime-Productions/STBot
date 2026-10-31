import { describe, expect, it, vi } from "vitest";
import {
  collectMessageCounts,
  listChatContainers,
  loadMemberNames,
  type RestLike,
} from "../src/lib/discordBackfill.js";

const GUILD = "g1";
const CHAT = "chat";
// Friday 2026-10-30 noon in Toronto; today's messages belong to the live counter.
const NOW = new Date("2026-10-30T16:00:00Z");

type Handler = (query: URLSearchParams) => unknown;

function fakeRest(routes: Record<string, Handler>) {
  const get = vi.fn(async (route: string, options?: { query?: URLSearchParams }) => {
    const handler = routes[route];
    if (!handler) throw new Error(`unexpected route ${route}`);
    return handler(options?.query ?? new URLSearchParams());
  });
  return { rest: { get } as unknown as RestLike, get };
}

function message(
  id: string,
  authorId: string,
  at: string,
  extra: { type?: number; bot?: boolean; global?: string | null; avatar?: string | null } = {}
) {
  return {
    id,
    type: extra.type ?? 0,
    timestamp: at,
    author: {
      id: authorId,
      bot: extra.bot ?? false,
      username: `user${authorId}`,
      global_name: extra.global ?? null,
      avatar: extra.avatar ?? null,
    },
  };
}

const MEMBERS: Handler = () => [
  {
    nick: "Kiara",
    avatar: "guildhash",
    user: { id: "1", username: "kiara_p", global_name: "Kiara G", avatar: "userhash" },
  },
  {
    nick: null,
    avatar: null,
    user: { id: "2", username: "denmar", global_name: "Denmar E", avatar: "dh" },
  },
  {
    nick: null,
    avatar: null,
    user: { id: "3", username: "abisan", global_name: null, avatar: null },
  },
];

const CHANNELS: Handler = () => [
  { id: "c1", type: 0, parent_id: CHAT },
  { id: "c2", type: 5, parent_id: CHAT },
  { id: "voice", type: 2, parent_id: CHAT },
  { id: "elsewhere", type: 0, parent_id: "games" },
  { id: "orphan", type: 0, parent_id: null },
];

describe("loadMemberNames", () => {
  it("prefers the server nickname, then global name, then username, with guild and user avatars", async () => {
    const { rest } = fakeRest({ [`/guilds/${GUILD}/members`]: MEMBERS });

    const names = await loadMemberNames(rest, GUILD);

    expect(names.get("1")).toEqual({
      name: "Kiara",
      avatarUrl: `https://cdn.discordapp.com/guilds/${GUILD}/users/1/avatars/guildhash.png?size=64`,
    });
    expect(names.get("2")).toEqual({
      name: "Denmar E",
      avatarUrl: "https://cdn.discordapp.com/avatars/2/dh.png?size=64",
    });
    expect(names.get("3")).toEqual({ name: "abisan", avatarUrl: undefined });
  });
});

describe("listChatContainers", () => {
  it("finds chat channels, active threads under them and every page of archived threads", async () => {
    const archivedPages: Record<string, unknown> = {
      first: {
        threads: [
          { id: "t-old-1", thread_metadata: { archive_timestamp: "2026-09-01T00:00:00Z" } },
        ],
        has_more: true,
      },
      "2026-09-01T00:00:00Z": {
        threads: [
          { id: "t-old-2", thread_metadata: { archive_timestamp: "2026-08-01T00:00:00Z" } },
        ],
        has_more: false,
      },
    };
    const { rest, get } = fakeRest({
      [`/guilds/${GUILD}/channels`]: CHANNELS,
      [`/guilds/${GUILD}/threads/active`]: () => ({
        threads: [
          { id: "t-live", parent_id: "c1" },
          { id: "t-other", parent_id: "elsewhere" },
          { id: "t-noparent" },
        ],
      }),
      "/channels/c1/threads/archived/public": (query) =>
        archivedPages[query.get("before") ?? "first"],
      "/channels/c2/threads/archived/public": () => ({ threads: [], has_more: false }),
    });

    const containers = await listChatContainers(rest, GUILD, CHAT);

    expect(containers.sort()).toEqual(["c1", "c2", "t-live", "t-old-1", "t-old-2"]);
    expect(get).toHaveBeenCalledWith(
      "/channels/c1/threads/archived/public",
      expect.objectContaining({ query: expect.any(URLSearchParams) })
    );
  });

  it("stops paging when a page has no archive timestamp to continue from", async () => {
    const { rest, get } = fakeRest({
      [`/guilds/${GUILD}/channels`]: () => [{ id: "c1", type: 0, parent_id: CHAT }],
      [`/guilds/${GUILD}/threads/active`]: () => ({ threads: [] }),
      "/channels/c1/threads/archived/public": () => ({ threads: [{ id: "t1" }], has_more: true }),
    });

    expect(await listChatContainers(rest, GUILD, CHAT)).toEqual(["c1", "t1"]);
    expect(get).toHaveBeenCalledTimes(3);
  });
});

describe("collectMessageCounts", () => {
  function setup(messagesByChannel: Record<string, Handler>) {
    return fakeRest({
      [`/guilds/${GUILD}/members`]: MEMBERS,
      [`/guilds/${GUILD}/channels`]: () => [{ id: "c1", type: 0, parent_id: CHAT }],
      [`/guilds/${GUILD}/threads/active`]: () => ({ threads: [{ id: "t1", parent_id: "c1" }] }),
      "/channels/c1/threads/archived/public": () => ({ threads: [], has_more: false }),
      ...messagesByChannel,
    });
  }

  it("counts whole past days per person, in Toronto days, skipping today, bots and non-chat messages", async () => {
    const { rest } = setup({
      "/channels/c1/messages": () => [
        message("9", "1", "2026-10-30T15:00:00Z"), // today: live counter's
        message("8", "2", "2026-10-30T01:30:00Z"), // 9:30 PM Oct 29 Toronto
        message("7", "2", "2026-10-29T18:00:00Z"),
        message("6", "1", "2026-10-29T17:00:00Z", { type: 19 }), // reply counts
        message("5", "1", "2026-10-29T16:00:00Z", { type: 7 }), // member join notice
        message("4", "9", "2026-10-29T15:00:00Z", { bot: true }),
        message("3", "3", "2026-10-28T15:00:00Z", { global: "Abi G", avatar: "ah" }),
      ],
      "/channels/t1/messages": () => [message("20", "1", "2026-10-28T15:00:00Z")],
    });

    const result = await collectMessageCounts({
      rest,
      guildId: GUILD,
      chatCategoryId: CHAT,
      now: NOW,
    });

    expect(result.channels).toBe(2);
    expect(result.messages).toBe(5);
    const byKey = Object.fromEntries(result.entries.map((e) => [`${e.discordId}|${e.day}`, e]));
    expect(byKey["2|2026-10-29"]).toMatchObject({ name: "Denmar E", count: 2 });
    expect(byKey["1|2026-10-29"]).toMatchObject({ name: "Kiara", count: 1 });
    expect(byKey["1|2026-10-28"]).toMatchObject({ count: 1 });
    // Not in the member list: falls back to the message author's own names and avatar.
    expect(byKey["3|2026-10-28"]).toMatchObject({ name: "abisan", count: 1 });
    expect(Object.keys(byKey)).not.toContain("1|2026-10-30");
    expect(Object.keys(byKey).some((key) => key.startsWith("9|"))).toBe(false);
  });

  it("falls back to the author's global name, username and avatar for people who left the server", async () => {
    const { rest } = setup({
      "/channels/c1/messages": () => [
        message("2", "50", "2026-10-29T15:00:00Z", { global: "Gone G", avatar: "gh" }),
        message("1", "51", "2026-10-29T14:00:00Z"),
      ],
      "/channels/t1/messages": () => [],
    });

    const { entries } = await collectMessageCounts({
      rest,
      guildId: GUILD,
      chatCategoryId: CHAT,
      now: NOW,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        discordId: "50",
        name: "Gone G",
        avatarUrl: "https://cdn.discordapp.com/avatars/50/gh.png?size=64",
      }),
      expect.objectContaining({ discordId: "51", name: "user51", avatarUrl: undefined }),
    ]);
  });

  it("pages back through full pages and stops at the one-year cutoff", async () => {
    const full = Array.from({ length: 100 }, (_, index) =>
      message(String(1000 - index), "1", "2026-10-29T15:00:00Z")
    );
    const second = [
      message("900", "1", "2026-10-28T15:00:00Z"),
      message("899", "1", "2025-10-01T15:00:00Z"), // older than a year: reached the cutoff
      message("898", "1", "2025-09-01T15:00:00Z"),
    ];
    const pages = vi.fn((query: URLSearchParams) => (query.get("before") ? second : full));
    const { rest, get } = setup({
      "/channels/c1/messages": pages,
      "/channels/t1/messages": () => [],
    });

    const { entries, messages } = await collectMessageCounts({
      rest,
      guildId: GUILD,
      chatCategoryId: CHAT,
      now: NOW,
    });

    expect(messages).toBe(101);
    expect(entries.find((entry) => entry.day === "2026-10-29")?.count).toBe(100);
    expect(pages).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith(
      "/channels/c1/messages",
      expect.objectContaining({ query: expect.any(URLSearchParams) })
    );
  });

  it("handles an empty channel and a custom window", async () => {
    const empty = vi.fn(() => []);
    const { rest } = setup({ "/channels/c1/messages": empty, "/channels/t1/messages": empty });

    const result = await collectMessageCounts({
      rest,
      guildId: GUILD,
      chatCategoryId: CHAT,
      now: NOW,
      days: 30,
    });

    expect(result).toEqual({ entries: [], channels: 2, messages: 0 });
    expect(empty).toHaveBeenCalledTimes(2);
  });
});
