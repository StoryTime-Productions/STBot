import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../src/types.js";

export const command: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with pong"),
  execute: async (interaction) => {
    await interaction.reply("pong");
  },
};
