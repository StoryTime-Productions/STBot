import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  db: {
    birthday: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const { db } = await import("../src/lib/db.js");
const { setBirthday, removeBirthday, listBirthdays, findTodaysBirthdays, validateMonthDay } =
  await import("../src/lib/birthdays.js");

describe("validateMonthDay", () => {
  it("accepts valid month/day pairs", () => {
    expect(() => validateMonthDay(1, 1)).not.toThrow();
    expect(() => validateMonthDay(12, 31)).not.toThrow();
  });

  it("allows February 29 (leap day)", () => {
    expect(() => validateMonthDay(2, 29)).not.toThrow();
  });

  it("rejects an out-of-range month", () => {
    expect(() => validateMonthDay(13, 1)).toThrow(RangeError);
    expect(() => validateMonthDay(0, 1)).toThrow(RangeError);
  });

  it("rejects a day that doesn't exist in the given month", () => {
    expect(() => validateMonthDay(4, 31)).toThrow(RangeError);
    expect(() => validateMonthDay(2, 30)).toThrow(RangeError);
  });
});

describe("setBirthday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a valid birthday", async () => {
    await setBirthday("user-1", 7, 10);
    expect(db.birthday.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1", month: 7, day: 10 },
      update: { month: 7, day: 10 },
    });
  });

  it("rejects an invalid date without touching the database", async () => {
    await expect(setBirthday("user-1", 2, 30)).rejects.toThrow(RangeError);
    expect(db.birthday.upsert).not.toHaveBeenCalled();
  });
});

describe("removeBirthday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a row is deleted", async () => {
    vi.mocked(db.birthday.delete).mockResolvedValueOnce({} as never);
    await expect(removeBirthday("user-1")).resolves.toBe(true);
  });

  it("returns false when there was nothing to delete", async () => {
    vi.mocked(db.birthday.delete).mockRejectedValueOnce(new Error("Record not found"));
    await expect(removeBirthday("user-1")).resolves.toBe(false);
  });
});

describe("listBirthdays", () => {
  it("returns all birthdays ordered by month then day", async () => {
    vi.mocked(db.birthday.findMany).mockResolvedValueOnce([
      { userId: "user-1", month: 1, day: 5 },
    ] as never);
    const result = await listBirthdays();
    expect(db.birthday.findMany).toHaveBeenCalledWith({
      orderBy: [{ month: "asc" }, { day: "asc" }],
    });
    expect(result).toEqual([{ userId: "user-1", month: 1, day: 5 }]);
  });
});

describe("findTodaysBirthdays", () => {
  it("queries by the given date's month and day", async () => {
    vi.mocked(db.birthday.findMany).mockResolvedValueOnce([]);
    await findTodaysBirthdays(new Date(2026, 6, 10)); // July 10
    expect(db.birthday.findMany).toHaveBeenCalledWith({ where: { month: 7, day: 10 } });
  });
});
