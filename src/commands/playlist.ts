import { SlashCommandBuilder } from "discord.js";
import { loadConfig } from "../config.js";
import { fetchSheetCsv, getSheetUrl, parseSheet, type WeekRow } from "../lib/playlistSheet.js";
import type { Command } from "../types.js";

const SPOTIFY_PLAYLIST_URL = "https://open.spotify.com/playlist/1WhzLDkFOghEZTqjDwYhJ4";

const data = new SlashCommandBuilder()
  .setName("playlist")
  .setDescription("Collaborative playlist stats")
  .addSubcommand((sub) => sub.setName("stats").setDescription("Show contribution stats"));

export const command: Command = {
  data,
  execute: async (interaction) => {
    const { playlistSheetId } = loadConfig();
    const csv = await fetchSheetCsv(playlistSheetId);
    const { people, weeks } = parseSheet(csv);

    const counts = new Map<string, number>(people.map((person) => [person, 0]));
    let totalEntries = 0;
    let currentWeek: WeekRow | undefined;

    for (const week of weeks) {
      for (const person of Object.keys(week.entries)) {
        counts.set(person, (counts.get(person) ?? 0) + 1);
        totalEntries++;
      }
      if (!currentWeek && week.status.toUpperCase() !== "DONE") {
        currentWeek = week;
      }
    }

    const topContributors =
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([person, count]) => `${person}: ${count}`)
        .join("\n") || "None yet.";

    const lines = [
      `Total entries: ${totalEntries}`,
      currentWeek
        ? `Current week: Week ${currentWeek.weekNumber} (${currentWeek.status})`
        : "All templated weeks are complete!",
      "",
      "Contributions:",
      topContributors,
      "",
      `Spreadsheet: ${getSheetUrl(playlistSheetId)}`,
      `Spotify playlist: ${SPOTIFY_PLAYLIST_URL}`,
    ];

    await interaction.reply(lines.join("\n"));
  },
};
