import type { ChatInputCommandInteraction } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/birthdays.js", () => ({
  setBirthday: vi.fn(),
  removeBirthday: vi.fn(),
  listBirthdays: vi.fn(),
}));

const { setBirthday, removeBirthday, listBirthdays } = await import("../../src/lib/birthdays.js");
const { command } = await import("../../src/commands/birthday.js");

function fakeInteraction(
  subcommand: string,
  options: { user?: { id: string }; month?: number; day?: number } = {}
): ChatInputCommandInteraction {
  return {
    options: {
      getSubcommand: () => subcommand,
      getUser: () => options.user ?? { id: "user-1", toString: () => "<@user-1>" },
      getInteger: (name: string) => (name === "month" ? options.month : options.day),
    },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe("birthday command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has admin-only default member permissions", () => {
    expect(command.data.name).toBe("birthday");
  });

  describe("set", () => {
    it("sets the birthday and replies with confirmation", async () => {
      const interaction = fakeInteraction("set", { month: 7, day: 10 });
      await command.execute(interaction);

      expect(setBirthday).toHaveBeenCalledWith("user-1", 7, 10);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("7/10"), ephemeral: true })
      );
    });

    it("replies with the validation error message on an invalid date", async () => {
      vi.mocked(setBirthday).mockRejectedValueOnce(
        new RangeError("Day must be an integer between 1 and 28")
      );
      const interaction = fakeInteraction("set", { month: 2, day: 30 });
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Day must be"),
          ephemeral: true,
        })
      );
    });
  });

  describe("remove", () => {
    it("confirms removal when a birthday existed", async () => {
      vi.mocked(removeBirthday).mockResolvedValueOnce(true);
      const interaction = fakeInteraction("remove");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("Removed") })
      );
    });

    it("says there was nothing to remove otherwise", async () => {
      vi.mocked(removeBirthday).mockResolvedValueOnce(false);
      const interaction = fakeInteraction("remove");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("no stored birthday") })
      );
    });
  });

  describe("list", () => {
    it("shows a message when there are no birthdays", async () => {
      vi.mocked(listBirthdays).mockResolvedValueOnce([]);
      const interaction = fakeInteraction("list");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "No birthdays stored yet." })
      );
    });

    it("lists every stored birthday", async () => {
      vi.mocked(listBirthdays).mockResolvedValueOnce([
        { userId: "user-1", month: 1, day: 5 },
        { userId: "user-2", month: 12, day: 25 },
      ]);
      const interaction = fakeInteraction("list");
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "<@user-1> — 1/5\n<@user-2> — 12/25",
        })
      );
    });
  });
});
