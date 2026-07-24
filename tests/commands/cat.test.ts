import type { ChatInputCommandInteraction } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { command } from "../../src/commands/cat.js";

describe("cat command", () => {
  it("replies with :3", async () => {
    const interaction = {
      reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as ChatInputCommandInteraction;
    await command.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(":3");
  });
});
