import { parse } from "csv-parse/sync";

export interface WeekRow {
  weekNumber: number;
  status: string;
  entries: Record<string, string>;
}

export interface ParsedSheet {
  people: string[];
  weeks: WeekRow[];
}

const WEEK_LABEL_RE = /^Week\s+(\d+)\s*\(([^)]*)\)\s*$/i;

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
  for (const row of rows.slice(firstWeekRowIndex)) {
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

    weeks.push({ weekNumber, status, entries });
  }

  return { people, weeks };
}
