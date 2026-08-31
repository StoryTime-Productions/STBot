import { db } from "./db.js";
import { fetchSheetCsv, getCellA1, parseSheet } from "./playlistSheet.js";
import { writeCellImage } from "./googleSheetsWriter.js";
import { logger } from "./logger.js";

const DONE = "DONE";

export interface FrownFillResult {
  filled: Array<{ weekNumber: number; person: string }>;
  skippedNoCredential: boolean;
}

/**
 * For every completed (DONE) week, finds members who never submitted an
 * entry and writes a frown-face image into their cell — idempotently:
 * re-derives "who's missing" from live sheet state on every call rather
 * than depending on a one-shot DONE-transition edge (see RalphDocs/STBot
 * spec 04 — this deliberately does not share playlistTracker.ts's
 * PlaylistWeekStatus persistence-ordering bug, since a missed run here
 * self-heals on the next poll instead of silently never firing again).
 * Already-filled cells (tracked in PlaylistFrownFill) are skipped so a
 * legitimate later submission isn't overwritten by a re-run.
 */
export async function fillMissingEntries(
  sheetId: string,
  googleServiceAccountKeyPath: string | undefined,
  frownImageUrl: string
): Promise<FrownFillResult> {
  if (!googleServiceAccountKeyPath) {
    return { filled: [], skippedNoCredential: true };
  }

  const csv = await fetchSheetCsv(sheetId);
  const { people, weeks } = parseSheet(csv);
  const filled: Array<{ weekNumber: number; person: string }> = [];

  for (const week of weeks) {
    if (week.status.toUpperCase() !== DONE) {
      continue;
    }

    const missing = people.filter((person) => !(person in week.entries));

    for (const person of missing) {
      const alreadyFilled = await db.playlistFrownFill.findUnique({
        where: { weekNumber_person: { weekNumber: week.weekNumber, person } },
      });
      if (alreadyFilled) {
        continue;
      }

      const personIndex = people.indexOf(person);
      const a1Range = getCellA1(week, personIndex);

      try {
        await writeCellImage(googleServiceAccountKeyPath, sheetId, a1Range, frownImageUrl);
        await db.playlistFrownFill.create({
          data: { weekNumber: week.weekNumber, person },
        });
        filled.push({ weekNumber: week.weekNumber, person });
      } catch (error: unknown) {
        logger.error("Failed to frown-fill a non-contributor's cell", {
          weekNumber: week.weekNumber,
          person,
          error: String(error),
        });
      }
    }
  }

  return { filled, skippedNoCredential: false };
}
