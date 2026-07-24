import type { Client } from "discord.js";
import { findTodaysBirthdays } from "./birthdays.js";
import { sendToChannel } from "./channelSender.js";

export async function announceTodaysBirthdays(client: Client, channelId: string): Promise<void> {
  const birthdays = await findTodaysBirthdays();

  for (const birthday of birthdays) {
    await sendToChannel(client, channelId, `🎂 It's <@${birthday.userId}>'s birthday today!`);
  }
}
