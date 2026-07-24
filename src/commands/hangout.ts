import { SlashCommandBuilder } from "discord.js";
import { loadConfig } from "../config.js";
import {
  addLogistics,
  InvalidStageTransitionError,
  listHangouts,
  lockHangout,
  proposeHangout,
  recordThread,
  scheduleHangout,
} from "../lib/hangouts.js";
import { sendToChannel } from "../lib/channelSender.js";
import { announceHangoutWithThread } from "../lib/hangoutThreads.js";
import type { Command } from "../types.js";

const data = new SlashCommandBuilder()
  .setName("hangout")
  .setDescription("Plan a hangout: idea -> When2Meet -> locked date -> locked logistics")
  .addSubcommand((sub) =>
    sub
      .setName("propose")
      .setDescription("Propose a new hangout idea")
      .addStringOption((opt) =>
        opt.setName("title").setDescription("What's the idea?").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("schedule")
      .setDescription("Attach a When2Meet link to a proposed hangout")
      .addIntegerOption((opt) =>
        opt.setName("event_id").setDescription("Hangout ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("when2meet_url").setDescription("The When2Meet link").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("lock")
      .setDescription("Lock in the date/time once When2Meet results are in")
      .addIntegerOption((opt) =>
        opt.setName("event_id").setDescription("Hangout ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("date_time").setDescription("The chosen date/time").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("logistics")
      .setDescription("Lock in logistics (meeting point, carpooling, etc.)")
      .addIntegerOption((opt) =>
        opt.setName("event_id").setDescription("Hangout ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("notes").setDescription("Logistics notes").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all hangouts and their current stage")
  );

export const command: Command = {
  data,
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    const { announcementsChannelId } = loadConfig();

    if (subcommand === "propose") {
      const title = interaction.options.getString("title", true);
      const event = await proposeHangout(title, interaction.user.id);
      await interaction.reply(`Proposed hangout #${event.id}: ${title}`);

      const threadId = await announceHangoutWithThread(
        interaction.client,
        announcementsChannelId,
        `📋 New hangout idea from <@${interaction.user.id}>: **${title}** (#${event.id})`,
        title
      );
      if (threadId) {
        await recordThread(event.id, threadId);
      }
      return;
    }

    try {
      if (subcommand === "schedule") {
        const id = interaction.options.getInteger("event_id", true);
        const url = interaction.options.getString("when2meet_url", true);
        const event = await scheduleHangout(id, url);
        await interaction.reply(`Hangout #${id} is now scheduling.`);
        await sendToChannel(
          interaction.client,
          announcementsChannelId,
          `🗓️ **${event.title}** (#${id}) — When2Meet: ${url}`
        );
        return;
      }

      if (subcommand === "lock") {
        const id = interaction.options.getInteger("event_id", true);
        const dateTime = interaction.options.getString("date_time", true);
        const event = await lockHangout(id, dateTime);
        await interaction.reply(`Hangout #${id} locked in for ${dateTime}.`);
        await sendToChannel(
          interaction.client,
          announcementsChannelId,
          `✅ **${event.title}** (#${id}) is locked in for **${dateTime}**`
        );
        return;
      }

      if (subcommand === "logistics") {
        const id = interaction.options.getInteger("event_id", true);
        const notes = interaction.options.getString("notes", true);
        const event = await addLogistics(id, notes);
        await interaction.reply(`Hangout #${id} logistics locked.`);
        await sendToChannel(
          interaction.client,
          announcementsChannelId,
          `📍 **${event.title}** (#${id}) logistics: ${notes}`
        );
        return;
      }
    } catch (error) {
      const message =
        error instanceof InvalidStageTransitionError ? error.message : "Something went wrong.";
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    const events = await listHangouts();
    if (events.length === 0) {
      await interaction.reply("No hangouts proposed yet.");
      return;
    }

    const lines = events.map((e) => `#${e.id} **${e.title}** — ${e.stage}`);
    await interaction.reply(lines.join("\n"));
  },
};
