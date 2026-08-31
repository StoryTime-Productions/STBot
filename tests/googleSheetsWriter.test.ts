import { describe, expect, it, vi } from "vitest";

const updateMock = vi.fn().mockResolvedValue(undefined);
const sheetsMock = vi.fn(() => ({
  spreadsheets: { values: { update: updateMock } },
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({ client_email: "bot@project.iam.gserviceaccount.com", private_key: "key" })
  ),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: vi.fn() },
    sheets: sheetsMock,
  },
}));

const { writeCellImage } = await import("../src/lib/googleSheetsWriter.js");

describe("writeCellImage", () => {
  it("writes an =IMAGE() formula to the given cell via the Sheets API", async () => {
    await writeCellImage("/key.json", "sheet-1", "B5", "http://img/frown.png");

    expect(updateMock).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      range: "B5",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [['=IMAGE("http://img/frown.png")']] },
    });
  });
});
