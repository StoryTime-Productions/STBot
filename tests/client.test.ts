import { GatewayIntentBits } from "discord.js";
import { describe, expect, it } from "vitest";
import { createClient } from "../src/client.js";

describe("createClient", () => {
  it("builds a client with Guilds and GuildMessageReactions intents", () => {
    const client = createClient();
    const intents = client.options.intents;

    expect(intents.has(GatewayIntentBits.Guilds)).toBe(true);
    expect(intents.has(GatewayIntentBits.GuildMessageReactions)).toBe(true);
  });

  it("no longer requests the privileged GuildMembers/GuildPresences intents (game-session logging removed)", () => {
    const client = createClient();
    const intents = client.options.intents;

    expect(intents.has(GatewayIntentBits.GuildMembers)).toBe(false);
    expect(intents.has(GatewayIntentBits.GuildPresences)).toBe(false);
  });
});
