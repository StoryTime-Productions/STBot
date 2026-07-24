import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../src/lib/logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info messages via console.log with a timestamp and level tag", () => {
    logger.info("bot started");
    expect(console.log).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("[INFO] bot started"));
  });

  it("includes metadata as JSON when provided", () => {
    logger.warn("rate limited", { retryAfter: 500 });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] rate limited {"retryAfter":500}')
    );
  });

  it("logs errors via console.error", () => {
    logger.error("connection failed");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR] connection failed")
    );
  });
});
