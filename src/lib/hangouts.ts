import { db } from "./db.js";

export type HangoutStage = "proposed" | "scheduling" | "locked" | "logistics_locked";

export interface HangoutEvent {
  id: number;
  title: string;
  proposedBy: string;
  stage: string;
  when2meetUrl: string | null;
  lockedAt: string | null;
  logistics: string | null;
  threadId: string | null;
  pingMessageId: string | null;
  lastPingedAt: Date | null;
  archived: boolean;
}

export class InvalidStageTransitionError extends Error {}

async function getEventOrThrow(id: number): Promise<HangoutEvent> {
  const event = await db.hangoutEvent.findUnique({ where: { id } });
  if (!event) {
    throw new InvalidStageTransitionError(`No hangout event with id ${id}`);
  }
  return event;
}

function assertStage(event: HangoutEvent, expected: HangoutStage): void {
  if (event.stage !== expected) {
    throw new InvalidStageTransitionError(
      `Hangout "${event.title}" is in stage "${event.stage}", not "${expected}" — can't do this yet`
    );
  }
}

export async function proposeHangout(title: string, proposedBy: string): Promise<HangoutEvent> {
  return db.hangoutEvent.create({ data: { title, proposedBy, stage: "proposed" } });
}

export async function scheduleHangout(id: number, when2meetUrl: string): Promise<HangoutEvent> {
  const event = await getEventOrThrow(id);
  assertStage(event, "proposed");

  return db.hangoutEvent.update({
    where: { id },
    data: { stage: "scheduling", when2meetUrl },
  });
}

export async function lockHangout(id: number, dateTime: string): Promise<HangoutEvent> {
  const event = await getEventOrThrow(id);
  assertStage(event, "scheduling");

  return db.hangoutEvent.update({
    where: { id },
    data: { stage: "locked", lockedAt: dateTime },
  });
}

export async function addLogistics(id: number, notes: string): Promise<HangoutEvent> {
  const event = await getEventOrThrow(id);
  assertStage(event, "locked");

  return db.hangoutEvent.update({
    where: { id },
    data: { stage: "logistics_locked", logistics: notes },
  });
}

export async function listHangouts(includeArchived = false): Promise<HangoutEvent[]> {
  return db.hangoutEvent.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordThread(id: number, threadId: string): Promise<void> {
  await db.hangoutEvent.update({ where: { id }, data: { threadId } });
}

export async function recordInactivityPing(
  id: number,
  pingMessageId: string,
  at: Date
): Promise<void> {
  await db.hangoutEvent.update({ where: { id }, data: { pingMessageId, lastPingedAt: at } });
}

export async function keepHangoutActive(pingMessageId: string): Promise<HangoutEvent | null> {
  const event = await db.hangoutEvent.findFirst({ where: { pingMessageId } });
  if (!event) {
    return null;
  }
  return db.hangoutEvent.update({
    where: { id: event.id },
    data: { pingMessageId: null, lastPingedAt: null },
  });
}

export async function archiveHangoutByPing(pingMessageId: string): Promise<HangoutEvent | null> {
  const event = await db.hangoutEvent.findFirst({ where: { pingMessageId } });
  if (!event) {
    return null;
  }
  return db.hangoutEvent.update({
    where: { id: event.id },
    data: { archived: true, pingMessageId: null },
  });
}

export async function listHangoutsWithThreads(): Promise<HangoutEvent[]> {
  return db.hangoutEvent.findMany({ where: { archived: false, threadId: { not: null } } });
}
