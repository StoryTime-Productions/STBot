import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  db: {
    hangoutEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const { db } = await import("../src/lib/db.js");
const {
  proposeHangout,
  scheduleHangout,
  lockHangout,
  addLogistics,
  listHangouts,
  recordThread,
  recordInactivityPing,
  keepHangoutActive,
  archiveHangoutByPing,
  listHangoutsWithThreads,
  InvalidStageTransitionError,
} = await import("../src/lib/hangouts.js");

const baseEvent = {
  id: 1,
  title: "Board game night",
  proposedBy: "user-1",
  when2meetUrl: null,
  lockedAt: null,
  logistics: null,
};

describe("proposeHangout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an event in the proposed stage", async () => {
    await proposeHangout("Board game night", "user-1");
    expect(db.hangoutEvent.create).toHaveBeenCalledWith({
      data: { title: "Board game night", proposedBy: "user-1", stage: "proposed" },
    });
  });
});

describe("scheduleHangout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves a proposed event to scheduling with the When2Meet link", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "proposed",
    } as never);

    await scheduleHangout(1, "https://when2meet.com/xyz");

    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stage: "scheduling", when2meetUrl: "https://when2meet.com/xyz" },
    });
  });

  it("throws if the event isn't in the proposed stage", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "locked",
    } as never);
    await expect(scheduleHangout(1, "url")).rejects.toThrow(InvalidStageTransitionError);
    expect(db.hangoutEvent.update).not.toHaveBeenCalled();
  });

  it("throws if the event doesn't exist", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce(null);
    await expect(scheduleHangout(999, "url")).rejects.toThrow(/No hangout event with id 999/);
  });
});

describe("lockHangout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves a scheduling event to locked with the date/time", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "scheduling",
    } as never);

    await lockHangout(1, "Saturday 3pm");

    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stage: "locked", lockedAt: "Saturday 3pm" },
    });
  });

  it("throws if the event isn't in the scheduling stage", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "proposed",
    } as never);
    await expect(lockHangout(1, "Saturday 3pm")).rejects.toThrow(InvalidStageTransitionError);
  });
});

describe("addLogistics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves a locked event to logistics_locked with notes", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "locked",
    } as never);

    await addLogistics(1, "Meet at the metro station");

    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stage: "logistics_locked", logistics: "Meet at the metro station" },
    });
  });

  it("throws if the event isn't in the locked stage", async () => {
    vi.mocked(db.hangoutEvent.findUnique).mockResolvedValueOnce({
      ...baseEvent,
      stage: "scheduling",
    } as never);
    await expect(addLogistics(1, "notes")).rejects.toThrow(InvalidStageTransitionError);
  });
});

describe("listHangouts", () => {
  it("excludes archived hangouts by default", async () => {
    vi.mocked(db.hangoutEvent.findMany).mockResolvedValueOnce([]);
    await listHangouts();
    expect(db.hangoutEvent.findMany).toHaveBeenCalledWith({
      where: { archived: false },
      orderBy: { createdAt: "desc" },
    });
  });

  it("includes archived hangouts when explicitly asked", async () => {
    vi.mocked(db.hangoutEvent.findMany).mockResolvedValueOnce([]);
    await listHangouts(true);
    expect(db.hangoutEvent.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("recordThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the thread id on the event", async () => {
    await recordThread(1, "thread-123");
    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { threadId: "thread-123" },
    });
  });
});

describe("recordInactivityPing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the ping message id and timestamp", async () => {
    const at = new Date("2026-07-10T00:00:00Z");
    await recordInactivityPing(1, "ping-msg-1", at);
    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { pingMessageId: "ping-msg-1", lastPingedAt: at },
    });
  });
});

describe("keepHangoutActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears ping state for the event matching the ping message", async () => {
    vi.mocked(db.hangoutEvent.findFirst).mockResolvedValueOnce({ ...baseEvent, id: 1 } as never);
    await keepHangoutActive("ping-msg-1");
    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { pingMessageId: null, lastPingedAt: null },
    });
  });

  it("returns null when no event matches the ping message", async () => {
    vi.mocked(db.hangoutEvent.findFirst).mockResolvedValueOnce(null);
    await expect(keepHangoutActive("unknown")).resolves.toBeNull();
    expect(db.hangoutEvent.update).not.toHaveBeenCalled();
  });
});

describe("archiveHangoutByPing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("archives the event matching the ping message", async () => {
    vi.mocked(db.hangoutEvent.findFirst).mockResolvedValueOnce({ ...baseEvent, id: 1 } as never);
    await archiveHangoutByPing("ping-msg-1");
    expect(db.hangoutEvent.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { archived: true, pingMessageId: null },
    });
  });

  it("returns null when no event matches the ping message", async () => {
    vi.mocked(db.hangoutEvent.findFirst).mockResolvedValueOnce(null);
    await expect(archiveHangoutByPing("unknown")).resolves.toBeNull();
  });
});

describe("listHangoutsWithThreads", () => {
  it("queries non-archived events that have a thread", async () => {
    vi.mocked(db.hangoutEvent.findMany).mockResolvedValueOnce([]);
    await listHangoutsWithThreads();
    expect(db.hangoutEvent.findMany).toHaveBeenCalledWith({
      where: { archived: false, threadId: { not: null } },
    });
  });
});
