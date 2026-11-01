import type { Guild, GuildMember, Message, VoiceState } from "discord.js";
import type { BotConfig } from "../config.js";
import { logger } from "./logger.js";
import { callStTools } from "./stTools.js";

export type StatsConfig = Pick<
  BotConfig,
  | "stToolsUrl"
  | "botApiSecret"
  | "chatCategoryId"
  | "voiceCategoryIds"
  | "voiceExcludedChannelIds"
  | "wordleChannelId"
>;

/** Counting needs the st-tools URL and secret; without them nothing is recorded or buffered. */
export function statsEnabled(config: Pick<StatsConfig, "stToolsUrl" | "botApiSecret">): boolean {
  return Boolean(config.stToolsUrl && config.botApiSecret);
}

/** The Toronto calendar day (YYYY-MM-DD) st-tools groups message counts by. */
export function torontoDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

interface Person {
  discordId: string;
  name: string;
  avatarUrl: string | null;
}

function personOf(member: GuildMember): Person {
  return {
    discordId: member.id,
    name: member.displayName,
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 64 }),
  };
}

interface VoiceChannelLike {
  id: string;
  name: string;
  parentId: string | null;
  guild: { afkChannelId: string | null };
}

/** A voice channel counts when it is in a counted voice category, is not the AFK channel and is not excluded. */
export function isCountedVoiceChannel(
  channel: VoiceChannelLike | null,
  config: Pick<StatsConfig, "voiceCategoryIds" | "voiceExcludedChannelIds">
): boolean {
  if (!channel) return false;
  return (
    channel.parentId !== null &&
    config.voiceCategoryIds.includes(channel.parentId) &&
    channel.id !== channel.guild.afkChannelId &&
    !config.voiceExcludedChannelIds.includes(channel.id)
  );
}

/** Join, leave and move between counted channels. Mute, deafen and stream changes are ignored. */
export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  config: StatsConfig
): Promise<void> {
  if (!statsEnabled(config)) return;
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const wasCounted = isCountedVoiceChannel(oldState.channel, config);
  const nowCounted = isCountedVoiceChannel(newState.channel, config);

  if (wasCounted && !nowCounted) {
    await callStTools(config, "discord/voice", { type: "leave", discordId: member.id });
    return;
  }
  if (
    nowCounted &&
    newState.channel &&
    (!wasCounted || oldState.channelId !== newState.channelId)
  ) {
    await callStTools(config, "discord/voice", {
      type: "join",
      ...personOf(member),
      channelId: newState.channel.id,
      channelName: newState.channel.name,
    });
  }
}

/** Everyone in a counted voice channel right now: closes sessions that ended while the bot was down. */
export async function sendVoiceSnapshot(guild: Guild, config: StatsConfig): Promise<void> {
  if (!statsEnabled(config)) return;
  const members: Array<Person & { channelId: string; channelName: string }> = [];
  for (const state of guild.voiceStates.cache.values()) {
    if (!state.member || state.member.user.bot || !state.channel) continue;
    if (!isCountedVoiceChannel(state.channel, config)) continue;
    members.push({
      ...personOf(state.member),
      channelId: state.channel.id,
      channelName: state.channel.name,
    });
  }
  await callStTools(config, "discord/voice", { type: "snapshot", members });
}

interface Pending extends Person {
  day: string;
  count: number;
}

const MAX_BATCH = 500;

/** Counts messages per person per Toronto day in memory and sends them in batches. Never stores text. */
export class MessageCounter {
  private pending = new Map<string, Pending>();

  /** One chat message from a human in the chat category (threads included). */
  record(message: Message, config: StatsConfig): void {
    if (!statsEnabled(config) || message.author.bot) return;
    const channel = message.channel;
    const container = channel.isThread() ? channel.parent : channel;
    if (!container || !("parentId" in container) || container.parentId !== config.chatCategoryId) {
      return;
    }

    const member = message.member;
    this.add({
      discordId: message.author.id,
      name: member?.displayName ?? message.author.globalName ?? message.author.username,
      avatarUrl: (member ?? message.author).displayAvatarURL({ extension: "png", size: 64 }),
      day: torontoDay(message.createdAt),
      count: 1,
    });
  }

  private add(entry: Pending): void {
    const key = `${entry.discordId}|${entry.day}`;
    const existing = this.pending.get(key);
    if (existing) {
      existing.count += entry.count;
      existing.name = entry.name;
      existing.avatarUrl = entry.avatarUrl ?? existing.avatarUrl;
    } else {
      this.pending.set(key, { ...entry });
    }
  }

  get size(): number {
    return this.pending.size;
  }

  /** Sends what is buffered; a batch st-tools did not accept is kept for the next flush. */
  async flush(config: StatsConfig): Promise<void> {
    if (!statsEnabled(config) || this.pending.size === 0) return;
    const entries = [...this.pending.values()];
    this.pending.clear();

    for (let start = 0; start < entries.length; start += MAX_BATCH) {
      const batch = entries.slice(start, start + MAX_BATCH);
      const answer = await callStTools(config, "discord/messages", {
        mode: "add",
        entries: batch.map(({ discordId, name, day, count, avatarUrl }) => ({
          discordId,
          name,
          day,
          count,
          ...(avatarUrl ? { avatarUrl } : {}),
        })),
      });
      if (answer === null) {
        for (const entry of batch) this.add(entry);
        logger.warn("Kept message counts for the next flush", { entries: batch.length });
      }
    }
  }
}

/** "…on an 80 day streak!" -> 80. */
export function parseWordleStreak(text: string): number | null {
  const match = /(\d+)[\s-]*day streak/i.exec(text);
  return match ? Number(match[1]) : null;
}

function isWordleChannel(message: Message, config: Pick<StatsConfig, "wordleChannelId">): boolean {
  const channel = message.channel;
  if (config.wordleChannelId) return channel.id === config.wordleChannelId;
  return "name" in channel && Boolean(channel.name?.includes("st-wordle"));
}

/** Reads the group streak from the Wordle app's daily post in the wordle channel. */
export async function handleWordleMessage(message: Message, config: StatsConfig): Promise<void> {
  if (!statsEnabled(config) || !isWordleChannel(message, config)) return;
  const text = [
    message.content,
    ...message.embeds.flatMap((embed) => [embed.title, embed.description]),
  ]
    .filter(Boolean)
    .join("\n");

  const streak = parseWordleStreak(text);
  if (streak === null) return;
  await callStTools(config, "discord/wordle", {
    streak,
    postedOn: torontoDay(message.createdAt),
  });
}
