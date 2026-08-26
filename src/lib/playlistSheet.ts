import { parse } from "csv-parse/sync";

export interface WeekRow {
  weekNumber: number;
  status: string;
  entries: Record<string, string>;
  /** 0-based index of this week's row in the raw parsed CSV — needed to
   * address a specific cell for writes (see playlistFrownFill.ts). */
  rowIndex: number;
}

export interface ParsedSheet {
  people: string[];
  weeks: WeekRow[];
}

const WEEK_LABEL_RE = /^Week\s+(\d+)\s*\(([^)]*)\)\s*$/i;

/** Converts a 0-based column index (0 = A) to its spreadsheet letter(s). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** A1 notation for a given week row + person column, e.g. "C5" (or
 * "Tab!C5" if sheetTabName is given — omit it to let the Sheets API
 * default to the first visible sheet, same tab fetchSheetCsv's plain
 * CSV export already assumes). personIndex is the 0-based index into
 * ParsedSheet.people; the sheet's person columns start at column B
 * (index 1), one past the week-label column A. */
export function getCellA1(week: WeekRow, personIndex: number, sheetTabName?: string): string {
  const column = columnLetter(personIndex + 1);
  const row = week.rowIndex + 1; // rows are 0-based internally, 1-based in A1 notation
  const cell = `${column}${row}`;
  return sheetTabName ? `${sheetTabName}!${cell}` : cell;
}

export function getSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

export async function fetchSheetCsv(sheetId: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist sheet (HTTP ${response.status})`);
  }

  return response.text();
}

export function parseSheet(csv: string): ParsedSheet {
  const rows: string[][] = parse(csv, { relax_column_count: true });

  const firstWeekRowIndex = rows.findIndex((row) => WEEK_LABEL_RE.test((row[0] ?? "").trim()));
  if (firstWeekRowIndex < 1) {
    throw new Error(
      "Could not locate week rows in the playlist sheet — its layout may have changed"
    );
  }

  const headerRow = rows[firstWeekRowIndex - 1] ?? [];
  const people = headerRow
    .slice(1)
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");

  const weeks: WeekRow[] = [];
  for (let rowIndex = firstWeekRowIndex; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const match = WEEK_LABEL_RE.exec((row[0] ?? "").trim());
    if (!match) {
      continue;
    }

    const weekNumber = Number(match[1]);
    const status = (match[2] ?? "").trim();
    const entries: Record<string, string> = {};

    people.forEach((person, index) => {
      const cell = (row[index + 1] ?? "").trim();
      if (cell !== "") {
        entries[person] = cell;
      }
    });

    weeks.push({ weekNumber, status, entries, rowIndex });
  }

  return { people, weeks };
}
