import { db } from "./db.js";
import { fetchSheetCsv, parseSheet } from "./playlistSheet.js";

export interface NewEntry {
  weekNumber: number;
  person: string;
  entry: string;
}

export interface CompletedWeek {
  weekNumber: number;
  entries: Record<string, string>;
  contributorCount: number;
  totalPeople: number;
}

export interface PollResult {
  newEntries: NewEntry[];
  completedWeeks: CompletedWeek[];
}

export interface CurrentWeekSummary {
  weekNumber: number;
  status: string;
  entries: Record<string, string>;
  contributorCount: number;
  totalPeople: number;
}

const DONE = "DONE";

export async function pollPlaylistSheet(sheetId: string): Promise<PollResult> {
  const csv = await fetchSheetCsv(sheetId);
  const { people, weeks } = parseSheet(csv);

  const newEntries: NewEntry[] = [];
  const completedWeeks: CompletedWeek[] = [];

  for (const week of weeks) {
    for (const [person, entry] of Object.entries(week.entries)) {
      const existing = await db.playlistEntry.findUnique({
        where: { weekNumber_person: { weekNumber: week.weekNumber, person } },
      });

      if (!existing || existing.entry !== entry) {
        await db.playlistEntry.upsert({
          where: { weekNumber_person: { weekNumber: week.weekNumber, person } },
          create: { weekNumber: week.weekNumber, person, entry },
          update: { entry },
        });
        newEntries.push({ weekNumber: week.weekNumber, person, entry });
      }
    }

    const previousStatus = await db.playlistWeekStatus.findUnique({
      where: { weekNumber: week.weekNumber },
    });
    const wasNotDone = !previousStatus || previousStatus.status.toUpperCase() !== DONE;
    const isNowDone = week.status.toUpperCase() === DONE;

    if (wasNotDone && isNowDone) {
      completedWeeks.push({
        weekNumber: week.weekNumber,
        entries: week.entries,
        contributorCount: Object.keys(week.entries).length,
        totalPeople: people.length,
      });
    }

    await db.playlistWeekStatus.upsert({
      where: { weekNumber: week.weekNumber },
      create: { weekNumber: week.weekNumber, status: week.status },
      update: { status: week.status },
    });
  }

  return { newEntries, completedWeeks };
}

export async function getCurrentWeekSummary(
  sheetId: string
): Promise<CurrentWeekSummary | undefined> {
  const csv = await fetchSheetCsv(sheetId);
  const { people, weeks } = parseSheet(csv);

  const currentWeek = weeks.find((week) => week.status.toUpperCase() !== DONE);
  if (!currentWeek) {
    return undefined;
  }

  return {
    weekNumber: currentWeek.weekNumber,
    status: currentWeek.status,
    entries: currentWeek.entries,
    contributorCount: Object.keys(currentWeek.entries).length,
    totalPeople: people.length,
  };
}
