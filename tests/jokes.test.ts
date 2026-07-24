import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  db: {
    joke: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { db } = await import("../src/lib/db.js");
const { addJoke, listJokes, randomJoke, incrementMention, JokeNotFoundError } =
  await import("../src/lib/jokes.js");

describe("addJoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a joke with an attribution", async () => {
    await addJoke("example joke", "logger-1", "Jordan");
    expect(db.joke.create).toHaveBeenCalledWith({
      data: { text: "example joke", loggedBy: "logger-1", attributedTo: "Jordan" },
    });
  });

  it("stores null attribution when none is given", async () => {
    await addJoke("some joke", "logger-1");
    expect(db.joke.create).toHaveBeenCalledWith({
      data: { text: "some joke", loggedBy: "logger-1", attributedTo: null },
    });
  });
});

describe("listJokes", () => {
  it("defaults to the 10 most recent jokes", async () => {
    vi.mocked(db.joke.findMany).mockResolvedValueOnce([]);
    await listJokes();
    expect(db.joke.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" }, take: 10 });
  });

  it("respects a custom limit", async () => {
    vi.mocked(db.joke.findMany).mockResolvedValueOnce([]);
    await listJokes(3);
    expect(db.joke.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" }, take: 3 });
  });
});

describe("randomJoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there are no jokes", async () => {
    vi.mocked(db.joke.count).mockResolvedValueOnce(0);
    await expect(randomJoke()).resolves.toBeNull();
    expect(db.joke.findMany).not.toHaveBeenCalled();
  });

  it("picks one joke via a random offset", async () => {
    vi.mocked(db.joke.count).mockResolvedValueOnce(5);
    vi.mocked(db.joke.findMany).mockResolvedValueOnce([
      { id: 1, text: "joke", attributedTo: null, loggedBy: "user-1", mentionCount: 0 },
    ] as never);

    const result = await randomJoke();

    expect(db.joke.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1, skip: expect.any(Number) })
    );
    expect(result).toEqual({
      id: 1,
      text: "joke",
      attributedTo: null,
      loggedBy: "user-1",
      mentionCount: 0,
    });
  });
});

describe("incrementMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments the mention count for the given joke", async () => {
    vi.mocked(db.joke.update).mockResolvedValueOnce({
      id: 1,
      text: "joke",
      attributedTo: null,
      loggedBy: "user-1",
      mentionCount: 3,
    } as never);

    const result = await incrementMention(1);

    expect(db.joke.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { mentionCount: { increment: 1 } },
    });
    expect(result.mentionCount).toBe(3);
  });

  it("throws JokeNotFoundError when the joke doesn't exist", async () => {
    vi.mocked(db.joke.update).mockRejectedValueOnce(new Error("Record not found"));
    await expect(incrementMention(999)).rejects.toThrow(JokeNotFoundError);
  });
});
