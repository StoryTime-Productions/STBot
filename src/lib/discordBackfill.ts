import { Routes } from "discord.js";
import { torontoDay } from "./discordStats.js";
import { logger } from "./logger.js";

/** The slice of discord.js' REST client the backfill needs, so tests can fake it. */
export interface RestLike {
  get(route: `/${string}`, options?: { query?: URLSearchParams }): Promise<unknown>;
}

export interface BackfillEntry {
  discordId: string;
  name: string;
  day: string;
  count: number;
  avatarUrl?: string;
}

interface ApiMember {
  nick?: string | null;
  avatar?: string | null;
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null };
}

interface ApiChannel {
  id: string;
  type: number;
  parent_id?: string | null;
}

interface ApiThread {
  id: string;
  parent_id?: string | null;
  thread_metadata?: { archive_timestamp?: string };
}

interface ApiMessage {
  id: string;
  type: number;
  timestamp: string;
  author: {
    id: string;
    bot?: boolean;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

const TEXT = 0;
const ANNOUNCEMENT = 5;
/** Ordinary messages (0) and replies (19); joins, pins and thread notices are not chat. */
const COUNTED_MESSAGE_TYPES = new Set([0, 19]);
const DAY_MS = 86_400_000;

const avatarUrl = (id: string, hash: string | null | undefined) =>
  hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64` : undefined;

/** Server nickname, else global name, else username: the same name the live counter reports. */
export async function loadMemberNames(rest: RestLike, guildId: string) {
  const members = (await rest.get(Routes.guildMembers(guildId), {
    query: new URLSearchParams({ limit: "1000" }),
  })) as ApiMember[];
  const names = new Map<string, { name: string; avatarUrl: string | undefined }>();
  for (const member of members) {
    const user = member.user;
    names.set(user.id, {
      name: member.nick ?? user.global_name ?? user.username,
      avatarUrl:
        member.avatar && user.id
          ? `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.png?size=64`
          : avatarUrl(user.id, user.avatar),
    });
  }
  return names;
}

/** Chat channels in the category plus their active and archived public threads. */
export async function listChatContainers(rest: RestLike, guildId: string, chatCategoryId: string) {
  const channels = (await rest.get(Routes.guildChannels(guildId))) as ApiChannel[];
  const chat = channels.filter(
    (channel) =>
      channel.parent_id === chatCategoryId &&
      (channel.type === TEXT || channel.type === ANNOUNCEMENT)
  );
  const ids = new Set(chat.map((channel) => channel.id));

  const active = (await rest.get(Routes.guildActiveThreads(guildId))) as { threads: ApiThread[] };
  const threads = new Set(
    active.threads
      .filter((thread) => thread.parent_id && ids.has(thread.parent_id))
      .map((t) => t.id)
  );

  for (const channel of chat) {
    let before: string | undefined;
    for (;;) {
      const query = new URLSearchParams({ limit: "100" });
      if (before) query.set("before", before);
      const page = (await rest.get(Routes.channelThreads(channel.id, "public"), { query })) as {
        threads: ApiThread[];
        has_more?: boolean;
      };
      for (const thread of page.threads) threads.add(thread.id);
      const last = page.threads[page.threads.length - 1];
      before = last?.thread_metadata?.archive_timestamp;
      if (!page.has_more || !before) break;
    }
  }

  return [...ids, ...threads];
}

/**
 * Counts human messages per person per Toronto day over the last `days` days, for whole days
 * before today only (today belongs to the live counter). Never reads or keeps message text.
 */
export async function collectMessageCounts(options: {
  rest: RestLike;
  guildId: string;
  chatCategoryId: string;
  now?: Date;
  days?: number;
}): Promise<{ entries: BackfillEntry[]; channels: number; messages: number }> {
  const { rest, guildId, chatCategoryId } = options;
  const now = options.now ?? new Date();
  const today = torontoDay(now);
  const cutoff = now.getTime() - (options.days ?? 365) * DAY_MS;

  const names = await loadMemberNames(rest, guildId);
  const containers = await listChatContainers(rest, guildId, chatCategoryId);
  const counts = new Map<string, BackfillEntry>();
  let messages = 0;

  for (const channelId of containers) {
    let before: string | undefined;
    let reachedCutoff = false;
    while (!reachedCutoff) {
      const query = new URLSearchParams({ limit: "100" });
      if (before) query.set("before", before);
      const page = (await rest.get(Routes.channelMessages(channelId), { query })) as ApiMessage[];
      if (page.length === 0) break;

      for (const message of page) {
        const at = new Date(message.timestamp);
        if (at.getTime() < cutoff) {
          reachedCutoff = true;
          continue;
        }
        const day = torontoDay(at);
        if (day >= today || message.author.bot || !COUNTED_MESSAGE_TYPES.has(message.type))
          continue;

        const known = names.get(message.author.id);
        const key = `${message.author.id}|${day}`;
        const entry = counts.get(key) ?? {
          discordId: message.author.id,
          name: known?.name ?? message.author.global_name ?? message.author.username,
          day,
          count: 0,
          avatarUrl: known?.avatarUrl ?? avatarUrl(message.author.id, message.author.avatar),
        };
        entry.count += 1;
        counts.set(key, entry);
        messages += 1;
      }

      before = page[page.length - 1]?.id;
      if (page.length < 100) break;
    }
  }

  logger.info("Collected message counts", { channels: containers.length, messages });
  return { entries: [...counts.values()], channels: containers.length, messages };
}
