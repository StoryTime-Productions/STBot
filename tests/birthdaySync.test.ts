import type { Guild } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/birthdays.js", () => ({ listBirthdays: vi.fn() }));
vi.mock("../src/lib/stTools.js", () => ({ callStTools: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { listBirthdays } = await import("../src/lib/birthdays.js");
const { callStTools } = await import("../src/lib/stTools.js");
const { logger } = await import("../src/lib/logger.js");
const { syncBirthdays, syncBirthdaysInBackground } = await import("../src/lib/birthdaySync.js");

const CONFIG = { stToolsUrl: "https://tools.test", botApiSecret: "s3cret" };

function guildWith(members: Record<string, { displayName: string; avatar: string }>): Guild {
  return {
    members: {
      fetch: vi.fn(async (id: string) => {
        const member = members[id];
        if (!member) throw new Error("Unknown Member");
        return {
          id,
          displayName: member.displayName,
          displayAvatarURL: () => member.avatar,
        };
      }),
    },
  } as unknown as Guild;
}

describe("syncBirthdays", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends each stored birthday with the member's name and avatar", async () => {
    vi.mocked(listBirthdays).mockResolvedValue([
      { userId: "1", month: 11, day: 14 },
      { userId: "2", month: 2, day: 29 },
    ]);
    const guild = guildWith({
      "1": { displayName: "Kiara", avatar: "https://cdn.test/1.png" },
      "2": { displayName: "Denmar", avatar: "https://cdn.test/2.png" },
    });

    await syncBirthdays(guild, CONFIG);

    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/birthdays", {
      birthdays: [
        { discordId: "1", name: "Kiara", avatarUrl: "https://cdn.test/1.png", month: 11, day: 14 },
        { discordId: "2", name: "Denmar", avatarUrl: "https://cdn.test/2.png", month: 2, day: 29 },
      ],
    });
  });

  it("skips members who left the server but still sends the rest", async () => {
    vi.mocked(listBirthdays).mockResolvedValue([
      { userId: "gone", month: 1, day: 1 },
      { userId: "2", month: 3, day: 3 },
    ]);
    const guild = guildWith({ "2": { displayName: "Denmar", avatar: "a" } });

    await syncBirthdays(guild, CONFIG);

    expect(logger.warn).toHaveBeenCalled();
    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/birthdays", {
      birthdays: [{ discordId: "2", name: "Denmar", avatarUrl: "a", month: 3, day: 3 }],
    });
  });

  it("sends an empty list so removals reach the dashboard", async () => {
    vi.mocked(listBirthdays).mockResolvedValue([]);
    await syncBirthdays(guildWith({}), CONFIG);
    expect(callStTools).toHaveBeenCalledWith(CONFIG, "discord/birthdays", { birthdays: [] });
  });

  it("does nothing without the st-tools link", async () => {
    await syncBirthdays(guildWith({}), { stToolsUrl: undefined, botApiSecret: undefined });
    expect(listBirthdays).not.toHaveBeenCalled();
    expect(callStTools).not.toHaveBeenCalled();
  });
});

describe("syncBirthdaysInBackground", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a missing guild", () => {
    syncBirthdaysInBackground(null, CONFIG);
    expect(listBirthdays).not.toHaveBeenCalled();
  });

  it("logs a failure instead of throwing", async () => {
    vi.mocked(listBirthdays).mockRejectedValue(new Error("db down"));
    syncBirthdaysInBackground(guildWith({}), CONFIG);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
  });
});
