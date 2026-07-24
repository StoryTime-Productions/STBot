import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Collection, REST, Routes } from "discord.js";
import type { Command } from "../types.js";

function isCommand(mod: unknown): mod is { command: Command } {
  return (
    typeof mod === "object" &&
    mod !== null &&
    "command" in mod &&
    typeof (mod as { command?: unknown }).command === "object"
  );
}

export async function loadCommands(dir: string): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return commands;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".js") && !entry.endsWith(".ts")) {
      continue;
    }

    const modUrl = pathToFileURL(path.join(dir, entry)).href;
    const mod: unknown = await import(modUrl);

    if (!isCommand(mod)) {
      continue;
    }

    commands.set(mod.command.data.name, mod.command);
  }

  return commands;
}

export async function registerCommands(
  rest: REST,
  applicationId: string,
  guildId: string,
  commands: Collection<string, Command>
): Promise<void> {
  const body = commands.map((command) => command.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
}
