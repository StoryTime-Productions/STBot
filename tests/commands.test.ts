import path from "node:path";
import { fileURLToPath } from "node:url";
import { Collection, type REST } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { loadCommands, registerCommands } from "../src/lib/commands.js";
import type { Command } from "../src/types.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/commands");

describe("loadCommands", () => {
  it("loads command modules from a directory, keyed by command name", async () => {
    const commands = await loadCommands(fixturesDir);
    expect(commands.size).toBe(1);
    expect(commands.get("ping")?.data.name).toBe("ping");
  });

  it("returns an empty collection when the directory doesn't exist", async () => {
    const commands = await loadCommands(path.join(fixturesDir, "does-not-exist"));
    expect(commands.size).toBe(0);
  });
});

describe("registerCommands", () => {
  it("PUTs the JSON representation of every command to the guild commands route", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const fakeRest = { put } as unknown as REST;

    const commands = new Collection<string, Command>();
    const pingModule = await import("./fixtures/commands/ping.js");
    commands.set("ping", pingModule.command);

    await registerCommands(fakeRest, "app-id", "guild-id", commands);

    expect(put).toHaveBeenCalledOnce();
    const [route, options] = put.mock.calls[0] as [string, { body: unknown[] }];
    expect(route).toContain("app-id");
    expect(route).toContain("guild-id");
    expect(options.body).toHaveLength(1);
  });
});
