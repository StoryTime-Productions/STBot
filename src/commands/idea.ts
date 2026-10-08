import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { loadConfig } from "../config.js";
import { callStTools, UNAVAILABLE, type StToolsMessage } from "../lib/stTools.js";
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
    const answer = (await callStTools(loadConfig(), "ideas", {
      title: interaction.options.getString("title", true),
      details: interaction.options.getString("description"),
      discordId: interaction.user.id,
      name:
        interaction.member && "displayName" in interaction.member
          ? interaction.member.displayName
          : interaction.user.displayName,
    })) as { message?: StToolsMessage; posted?: boolean; channelId?: string | null } | null;
    // The public post already shows the idea; a private copy next to it is noise.
    if (answer?.posted && answer.channelId === interaction.channelId) {
      await interaction.deleteReply();
      return;
    }
    const message = answer?.message?.embeds ? answer.message : UNAVAILABLE;
    await interaction.editReply(message as Parameters<typeof interaction.editReply>[0]);
  },
};
