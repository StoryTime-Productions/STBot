import { SlashCommandBuilder } from "discord.js";
import {
  addJoke,
  incrementMention,
  JokeNotFoundError,
  listJokes,
  randomJoke,
} from "../lib/jokes.js";
import type { Command } from "../types.js";

const data = new SlashCommandBuilder()
  .setName("joke")
  .setDescription("Log and recall StoryTime inside jokes")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Log a new inside joke")
      .addStringOption((opt) =>
        opt.setName("text").setDescription("The joke/quote").setRequired(true)
      )
      .addUserOption((opt) =>
        opt.setName("who").setDescription("Who it's attributed to (optional)").setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("Show the most recent jokes"))
  .addSubcommand((sub) =>
    sub.setName("random").setDescription("Surface a random joke from the archive")
  )
  .addSubcommand((sub) =>
    sub
      .setName("mention")
      .setDescription("Bump a joke's mention count — someone said it again")
      .addIntegerOption((opt) =>
        opt.setName("joke_id").setDescription("The joke's ID (see /joke list)").setRequired(true)
      )
  );

function formatJoke(joke: {
  id: number;
  text: string;
  attributedTo: string | null;
  mentionCount: number;
}): string {
  const attribution = joke.attributedTo ? ` — ${joke.attributedTo}` : "";
  const mentions = joke.mentionCount > 0 ? ` (used ${joke.mentionCount}×)` : "";
  return `#${joke.id} "${joke.text}"${attribution}${mentions}`;
}

export const command: Command = {
  data,
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const text = interaction.options.getString("text", true);
      const who = interaction.options.getUser("who");
      const joke = await addJoke(text, interaction.user.id, who?.username);
      await interaction.reply(`Logged: ${formatJoke(joke)}`);
      return;
    }

    if (subcommand === "random") {
      const joke = await randomJoke();
      await interaction.reply(joke ? formatJoke(joke) : "No jokes logged yet.");
      return;
    }

    if (subcommand === "mention") {
      const id = interaction.options.getInteger("joke_id", true);
      try {
        const joke = await incrementMention(id);
        await interaction.reply(`${formatJoke(joke)} — mentioned again!`);
      } catch (error) {
        const message =
          error instanceof JokeNotFoundError ? error.message : "Something went wrong.";
        await interaction.reply({ content: message, ephemeral: true });
      }
      return;
    }

    const jokes = await listJokes();
    if (jokes.length === 0) {
      await interaction.reply("No jokes logged yet.");
      return;
    }

    await interaction.reply(jokes.map(formatJoke).join("\n"));
  },
};
