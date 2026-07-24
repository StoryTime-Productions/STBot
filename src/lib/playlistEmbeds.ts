import { EmbedBuilder } from "discord.js";
import type { SongMatch } from "./musicLookup.js";

const EMBED_COLOR = 0x1db954;

const MAX_EMBEDS_PER_MESSAGE = 10;

export interface WeeklyDigestWeek {
  weekNumber: number;
  status?: string;
  entries: Record<string, string>;
  contributorCount: number;
  totalPeople: number;
}

export function buildHeaderLine(week: WeeklyDigestWeek, heading: string): string {
  const statusSuffix = week.status ? ` (${week.status})` : "";
  return `${heading} — Week ${week.weekNumber}${statusSuffix}\n(${week.contributorCount}/${week.totalPeople} contributed)`;
}

export function buildContributorEmbed(
  person: string,
  entry: string,
  match: SongMatch | null
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(EMBED_COLOR).setAuthor({ name: person });

  if (!match) {
    return embed.setTitle(entry).setDescription("No match found for this entry.");
  }

  embed.setTitle(`${match.title} — ${match.artistName}`);
  if (match.trackUrl) {
    embed.setURL(match.trackUrl);
  }
  if (match.albumArtUrl) {
    embed.setThumbnail(match.albumArtUrl);
  }

  return embed;
}

export function chunkEmbeds(embeds: EmbedBuilder[]): EmbedBuilder[][] {
  if (embeds.length === 0) {
    return [];
  }

  const chunks: EmbedBuilder[][] = [];
  for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
    chunks.push(embeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE));
  }
  return chunks;
}
