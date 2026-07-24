import type { ChatInputCommandInteraction } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({ announcementsChannelId: "channel-1" }),
}));

vi.mock("../../src/lib/channelSender.js", () => ({
  sendToChannel: vi.fn(),
}));

vi.mock("../../src/lib/hangoutThreads.js", () => ({
  announceHangoutWithThread: vi.fn(),
}));

vi.mock("../../src/lib/hangouts.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/hangouts.js")>(
    "../../src/lib/hangouts.js"
  );
  return {
    ...actual,
    proposeHangout: vi.fn(),
    scheduleHangout: vi.fn(),
    lockHangout: vi.fn(),
    addLogistics: vi.fn(),
    listHangouts: vi.fn(),
    recordThread: vi.fn(),
  };
});

const {
  proposeHangout,
  scheduleHangout,
  lockHangout,
  addLogistics,
  listHangouts,
  recordThread,
  InvalidStageTransitionError,
} = await import("../../src/lib/hangouts.js");
const { sendToChannel } = await import("../../src/lib/channelSender.js");
const { announceHangoutWithThread } = await import("../../src/lib/hangoutThreads.js");
const { command } = await import("../../src/commands/hangout.js");

function fakeInteraction(
  subcommand: string,
  options: { title?: string; eventId?: number; string?: string } = {}
): ChatInputCommandInteraction {
  return {
    user: { id: "author-1" },
    client: {},
    options: {
      getSubcommand: () => subcommand,
      getString: () => options.title ?? options.string,
      getInteger: () => options.eventId,
    },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

const baseEvent = {
  id: 1,
  title: "Board game night",
  proposedBy: "author-1",
  stage: "proposed",
  when2meetUrl: null,
  lockedAt: null,
  logistics: null,
  threadId: null,
  pingMessageId: null,
  lastPingedAt: null,
  archived: false,
};

describe("hangout command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propose: creates the event, creates a thread, and records it", async () => {
    vi.mocked(proposeHangout).mockResolvedValueOnce(baseEvent);
    vi.mocked(announceHangoutWithThread).mockResolvedValueOnce("thread-1");
    const interaction = fakeInteraction("propose", { title: "Board game night" });

    await command.execute(interaction);

    expect(proposeHangout).toHaveBeenCalledWith("Board game night", "author-1");
    expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining("#1"));
    expect(announceHangoutWithThread).toHaveBeenCalledWith(
      interaction.client,
      "channel-1",
      expect.stringContaining("Board game night"),
      "Board game night"
    );
    expect(recordThread).toHaveBeenCalledWith(1, "thread-1");
  });

  it("propose: doesn't record a thread if the channel couldn't support one", async () => {
    vi.mocked(proposeHangout).mockResolvedValueOnce(baseEvent);
    vi.mocked(announceHangoutWithThread).mockResolvedValueOnce(null);
    const interaction = fakeInteraction("propose", { title: "Board game night" });

    await command.execute(interaction);

    expect(recordThread).not.toHaveBeenCalled();
  });

  it("schedule: moves the event forward and announces the When2Meet link", async () => {
    vi.mocked(scheduleHangout).mockResolvedValueOnce({
      ...baseEvent,
      stage: "scheduling",
      when2meetUrl: "https://when2meet.com/xyz",
    });
    const interaction = fakeInteraction("schedule", {
      eventId: 1,
      string: "https://when2meet.com/xyz",
    });

    await command.execute(interaction);

    expect(scheduleHangout).toHaveBeenCalledWith(1, "https://when2meet.com/xyz");
    expect(sendToChannel).toHaveBeenCalledWith(
      interaction.client,
      "channel-1",
      expect.stringContaining("when2meet.com")
    );
  });

  it("lock: replies with an ephemeral error on an invalid stage transition", async () => {
    vi.mocked(lockHangout).mockRejectedValueOnce(new InvalidStageTransitionError("wrong stage"));
    const interaction = fakeInteraction("lock", { eventId: 1, string: "Saturday 3pm" });

    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({ content: "wrong stage", ephemeral: true });
    expect(sendToChannel).not.toHaveBeenCalled();
  });

  it("logistics: locks logistics and announces", async () => {
    vi.mocked(addLogistics).mockResolvedValueOnce({
      ...baseEvent,
      stage: "logistics_locked",
      logistics: "Meet at the metro",
    });
    const interaction = fakeInteraction("logistics", { eventId: 1, string: "Meet at the metro" });

    await command.execute(interaction);

    expect(addLogistics).toHaveBeenCalledWith(1, "Meet at the metro");
    expect(sendToChannel).toHaveBeenCalledWith(
      interaction.client,
      "channel-1",
      expect.stringContaining("Meet at the metro")
    );
  });

  it("list: shows every hangout with its stage", async () => {
    vi.mocked(listHangouts).mockResolvedValueOnce([baseEvent]);
    const interaction = fakeInteraction("list");

    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith("#1 **Board game night** — proposed");
  });

  it("list: says nothing's proposed yet when empty", async () => {
    vi.mocked(listHangouts).mockResolvedValueOnce([]);
    const interaction = fakeInteraction("list");

    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith("No hangouts proposed yet.");
  });
});
