import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { listBirthdays, removeBirthday, setBirthday } from "../lib/birthdays.js";
import type { Command } from "../types.js";

const data = new SlashCommandBuilder()
  .setName("birthday")
  .setDescription("Manage member birthdays")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a member's birthday")
      .addUserOption((opt) => opt.setName("user").setDescription("The member").setRequired(true))
      .addIntegerOption((opt) =>
        opt
          .setName("month")
          .setDescription("Month (1-12)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(12)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("day")
          .setDescription("Day (1-31)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(31)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a member's birthday")
      .addUserOption((opt) => opt.setName("user").setDescription("The member").setRequired(true))
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all stored birthdays"));

export const command: Command = {
  data,
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const user = interaction.options.getUser("user", true);
      const month = interaction.options.getInteger("month", true);
      const day = interaction.options.getInteger("day", true);

      try {
        await setBirthday(user.id, month, day);
        await interaction.reply({
          content: `Set ${user}'s birthday to ${month}/${day}.`,
          ephemeral: true,
        });
      } catch (error) {
        const message = error instanceof RangeError ? error.message : "Failed to set birthday.";
        await interaction.reply({ content: message, ephemeral: true });
      }
      return;
    }

    if (subcommand === "remove") {
      const user = interaction.options.getUser("user", true);
      const removed = await removeBirthday(user.id);
      await interaction.reply({
        content: removed ? `Removed ${user}'s birthday.` : `${user} has no stored birthday.`,
        ephemeral: true,
      });
      return;
    }

    const birthdays = await listBirthdays();
    if (birthdays.length === 0) {
      await interaction.reply({ content: "No birthdays stored yet.", ephemeral: true });
      return;
    }

    const lines = birthdays.map((b) => `<@${b.userId}> — ${b.month}/${b.day}`);
    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  },
};
