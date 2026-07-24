import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/hangouts.js", () => ({
  keepHangoutActive: vi.fn(),
  archiveHangoutByPing: vi.fn(),
}));

const { keepHangoutActive, archiveHangoutByPing } = await import("../src/lib/hangouts.js");
const { handleHangoutPingReaction } = await import("../src/lib/hangoutReactions.js");

describe("handleHangoutPingReaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the hangout active on a checkmark reaction", async () => {
    await handleHangoutPingReaction("msg-1", "✅");
    expect(keepHangoutActive).toHaveBeenCalledWith("msg-1");
    expect(archiveHangoutByPing).not.toHaveBeenCalled();
  });

  it("archives the hangout on a wastebasket reaction", async () => {
    await handleHangoutPingReaction("msg-1", "🗑️");
    expect(archiveHangoutByPing).toHaveBeenCalledWith("msg-1");
    expect(keepHangoutActive).not.toHaveBeenCalled();
  });

  it("does nothing for an unrelated reaction", async () => {
    await handleHangoutPingReaction("msg-1", "👍");
    expect(keepHangoutActive).not.toHaveBeenCalled();
    expect(archiveHangoutByPing).not.toHaveBeenCalled();
  });
});
