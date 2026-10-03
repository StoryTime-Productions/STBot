import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { loadConfig } from "../config.js";
import { messageFromStTools } from "../lib/stTools.js";
import type { Command } from "../types.js";

const data = new SlashCommandBuilder()
  .setName("idea")
  .setDescription("Suggest a hangout idea for the hub")
  .addStringOption((opt) =>
    opt.setName("title").setDescription("What's the idea?").setRequired(true).setMaxLength(100)
  )
  .addStringOption((opt) =>
    opt.setName("description").setDescription("Any details?").setMaxLength(1000)
  );

export const command: Command = {
  data,
  execute: async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const message = await messageFromStTools(loadConfig(), "ideas", {
      title: interaction.options.getString("title", true),
      details: interaction.options.getString("description"),
      discordId: interaction.user.id,
      name:
        interaction.member && "displayName" in interaction.member
          ? interaction.member.displayName
          : interaction.user.displayName,
    });
    await interaction.editReply(message as Parameters<typeof interaction.editReply>[0]);
  },
};
