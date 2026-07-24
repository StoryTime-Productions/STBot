import { db } from "./db.js";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface Birthday {
  userId: string;
  month: number;
  day: number;
}

export function validateMonthDay(month: number, day: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Month must be an integer between 1 and 12, got ${month}`);
  }

  const maxDay = DAYS_IN_MONTH[month - 1] as number;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new RangeError(
      `Day must be an integer between 1 and ${maxDay} for month ${month}, got ${day}`
    );
  }
}

export async function setBirthday(userId: string, month: number, day: number): Promise<void> {
  validateMonthDay(month, day);

  await db.birthday.upsert({
    where: { userId },
    create: { userId, month, day },
    update: { month, day },
  });
}

export async function removeBirthday(userId: string): Promise<boolean> {
  try {
    await db.birthday.delete({ where: { userId } });
    return true;
  } catch {
    return false;
  }
}

export async function listBirthdays(): Promise<Birthday[]> {
  return db.birthday.findMany({ orderBy: [{ month: "asc" }, { day: "asc" }] });
}

export async function findTodaysBirthdays(today: Date = new Date()): Promise<Birthday[]> {
  return db.birthday.findMany({
    where: { month: today.getMonth() + 1, day: today.getDate() },
  });
}
