import type { ChatInputCommandInteraction } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/jokes.js", () => ({
  addJoke: vi.fn(),
  listJokes: vi.fn(),
  randomJoke: vi.fn(),
  incrementMention: vi.fn(),
  JokeNotFoundError: class JokeNotFoundError extends Error {},
}));

const { addJoke, listJokes, randomJoke, incrementMention, JokeNotFoundError } =
  await import("../../src/lib/jokes.js");
const { command } = await import("../../src/commands/joke.js");

function fakeInteraction(
  subcommand: string,
  options: { text?: string; who?: { username: string } | null; jokeId?: number } = {}
): ChatInputCommandInteraction {
  return {
    user: { id: "author-1" },
    options: {
      getSubcommand: () => subcommand,
      getString: () => options.text,
      getUser: () => options.who ?? null,
      getInteger: () => options.jokeId,
    },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe("joke command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("add", () => {
    it("logs the joke and replies with confirmation, with attribution", async () => {
      vi.mocked(addJoke).mockResolvedValueOnce({
        id: 1,
        text: "example joke",
        attributedTo: "Jordan",
        loggedBy: "author-1",
        mentionCount: 0,
      });
      const interaction = fakeInteraction("add", {
        text: "example joke",
        who: { username: "Jordan" },
      });
      await command.execute(interaction);

      expect(addJoke).toHaveBeenCalledWith("example joke", "author-1", "Jordan");
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining("example joke"));
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining("Jordan"));
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining("#1"));
    });

    it("logs without attribution when no user is given", async () => {
      vi.mocked(addJoke).mockResolvedValueOnce({
        id: 2,
        text: "some joke",
        attributedTo: null,
        loggedBy: "author-1",
        mentionCount: 0,
      });
      const interaction = fakeInteraction("add", { text: "some joke" });
      await command.execute(interaction);

      expect(addJoke).toHaveBeenCalledWith("some joke", "author-1", undefined);
    });
  });

  describe("random", () => {
    it("shows a random joke when one exists", async () => {
      vi.mocked(randomJoke).mockResolvedValueOnce({
        id: 1,
        text: "some joke",
        attributedTo: null,
        loggedBy: "user-1",
        mentionCount: 0,
      });
      const interaction = fakeInteraction("random");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('#1 "some joke"');
    });

    it("includes mention count when greater than zero", async () => {
      vi.mocked(randomJoke).mockResolvedValueOnce({
        id: 1,
        text: "some joke",
        attributedTo: null,
        loggedBy: "user-1",
        mentionCount: 3,
      });
      const interaction = fakeInteraction("random");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('#1 "some joke" (used 3×)');
    });

    it("says nothing's logged yet when the archive is empty", async () => {
      vi.mocked(randomJoke).mockResolvedValueOnce(null);
      const interaction = fakeInteraction("random");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith("No jokes logged yet.");
    });
  });

  describe("mention", () => {
    it("increments and confirms with the new count", async () => {
      vi.mocked(incrementMention).mockResolvedValueOnce({
        id: 1,
        text: "example joke",
        attributedTo: "Jordan",
        loggedBy: "user-1",
        mentionCount: 2,
      });
      const interaction = fakeInteraction("mention", { jokeId: 1 });
      await command.execute(interaction);

      expect(incrementMention).toHaveBeenCalledWith(1);
      expect(interaction.reply).toHaveBeenCalledWith(
        '#1 "example joke" — Jordan (used 2×) — mentioned again!'
      );
    });

    it("replies with an ephemeral error when the joke doesn't exist", async () => {
      vi.mocked(incrementMention).mockRejectedValueOnce(
        new JokeNotFoundError("No joke with id 99")
      );
      const interaction = fakeInteraction("mention", { jokeId: 99 });
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "No joke with id 99",
        ephemeral: true,
      });
    });
  });

  describe("list", () => {
    it("lists recent jokes", async () => {
      vi.mocked(listJokes).mockResolvedValueOnce([
        { id: 1, text: "joke one", attributedTo: "Riley", loggedBy: "user-1", mentionCount: 0 },
        { id: 2, text: "joke two", attributedTo: null, loggedBy: "user-2", mentionCount: 5 },
      ]);
      const interaction = fakeInteraction("list");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        '#1 "joke one" — Riley\n#2 "joke two" (used 5×)'
      );
    });

    it("says nothing's logged yet when empty", async () => {
      vi.mocked(listJokes).mockResolvedValueOnce([]);
      const interaction = fakeInteraction("list");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith("No jokes logged yet.");
    });
  });
});
