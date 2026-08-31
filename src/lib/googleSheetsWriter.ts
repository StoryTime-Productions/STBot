import { readFileSync } from "node:fs";
import { google } from "googleapis";

function getClient(serviceAccountKeyPath: string): ReturnType<typeof google.sheets> {
  const key = JSON.parse(readFileSync(serviceAccountKeyPath, "utf8")) as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Writes an =IMAGE(url) formula into a single cell. The target sheet
 * must be shared as Editor with the service account's client_email, or
 * this throws (caller is expected to catch and log, not crash a cron
 * tick over one failed write).
 */
export async function writeCellImage(
  serviceAccountKeyPath: string,
  sheetId: string,
  a1Range: string,
  imageUrl: string
): Promise<void> {
  const sheets = getClient(serviceAccountKeyPath);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: a1Range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[`=IMAGE("${imageUrl}")`]],
    },
  });
}
