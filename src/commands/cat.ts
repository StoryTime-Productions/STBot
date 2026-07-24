import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";

const data = new SlashCommandBuilder().setName("cat").setDescription("Returns :3");

export const command: Command = {
  data,
  execute: async (interaction) => {
    await interaction.reply(":3");
  },
};
