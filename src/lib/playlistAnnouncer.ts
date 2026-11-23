import type { Client } from "discord.js";
import { markEntriesSeen, type CurrentWeekSummary, type PollResult } from "./playlistTracker.js";
import { sendEmbedsToChannel, sendToChannel } from "./channelSender.js";
import { lookupSong } from "./musicLookup.js";
import {
  buildContributorEmbed,
  buildHeaderLine,
  chunkEmbeds,
  type WeeklyDigestWeek,
} from "./playlistEmbeds.js";

async function announceEntry(
  client: Client,
  channelId: string,
  weekNumber: number,
  person: string,
  entry: string
): Promise<void> {
  const match = await lookupSong(entry);
  const embed = buildContributorEmbed(person, entry, match);
  await sendEmbedsToChannel(client, channelId, [embed], `🎵 New entry for Week ${weekNumber}`);
}

async function announceWeekDigest(
  client: Client,
  channelId: string,
  week: WeeklyDigestWeek,
  heading: string
): Promise<void> {
  const people = Object.entries(week.entries);
  if (people.length === 0) {
    await sendToChannel(client, channelId, `${buildHeaderLine(week, heading)}\nNo entries yet.`);
    return;
  }

  const embeds = await Promise.all(
    people.map(([person, entry]) =>
      lookupSong(entry).then((match) => buildContributorEmbed(person, entry, match))
    )
  );

  const chunks = chunkEmbeds(embeds);
  for (const [index, chunk] of chunks.entries()) {
    await sendEmbedsToChannel(
      client,
      channelId,
      chunk,
      index === 0 ? buildHeaderLine(week, heading) : undefined
    );
  }
}

export async function announcePlaylistUpdates(
  client: Client,
  channelId: string,
  result: PollResult
): Promise<void> {
  // A completed week's digest lists every entry, so announcing them one by one as well is noise.
  const digestWeeks = new Set(result.completedWeeks.map((week) => week.weekNumber));
  for (const entry of result.newEntries) {
    if (digestWeeks.has(entry.weekNumber)) {
      continue;
    }
    await announceEntry(client, channelId, entry.weekNumber, entry.person, entry.entry);
  }

  for (const week of result.completedWeeks) {
    await announceWeekDigest(client, channelId, week, "✅ Week complete!");
  }
}

export async function announceWeeklySummary(
  client: Client,
  channelId: string,
  week: CurrentWeekSummary | undefined
): Promise<void> {
  if (!week) {
    await sendToChannel(
      client,
      channelId,
      "📅 Weekly playlist summary: all templated weeks are complete!"
    );
    return;
  }

  await announceWeekDigest(client, channelId, week, "📅 Weekly playlist summary");
  // The summary just listed these songs, so the next poll must not report them as new.
  await markEntriesSeen(week);
}
