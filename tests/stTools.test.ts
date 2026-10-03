import { afterEach, describe, expect, it, vi } from "vitest";
import { callStTools, messageFromStTools, tickStTools, UNAVAILABLE } from "../src/lib/stTools.js";

const config = { stToolsUrl: "https://hub.test", botApiSecret: "s3cret" };
const message = { embeds: [{ title: "ok" }] };

afterEach(() => vi.unstubAllGlobals());

describe("callStTools", () => {
  it("posts JSON with the bearer secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(callStTools(config, "tick", { a: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://hub.test/api/bot/tick");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    expect(init.body).toBe('{"a":1}');
  });

  it("returns null without calling fetch when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await callStTools({ stToolsUrl: undefined, botApiSecret: "x" }, "tick", {})).toBeNull();
    expect(
      await callStTools({ stToolsUrl: "https://hub.test", botApiSecret: undefined }, "tick", {})
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when st-tools is down or answers non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await callStTools(config, "tick", {})).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await callStTools(config, "tick", {})).toBeNull();
  });
});

describe("messageFromStTools", () => {
  it("returns the message st-tools sent, refusals included", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, message }) })
    );
    expect(await messageFromStTools(config, "attendance", {})).toEqual(message);
  });

  it("falls back to the unavailable embed when st-tools is down or malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await messageFromStTools(config, "ideas", {})).toBe(UNAVAILABLE);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );
    expect(await messageFromStTools(config, "ideas", {})).toBe(UNAVAILABLE);
  });

  it("has no emphasis markup in the fallback (G2)", () => {
    expect(JSON.stringify(UNAVAILABLE)).not.toMatch(/\*|__|~~|`/);
  });
});

describe("tickStTools", () => {
  it("posts to the tick route and swallows failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(tickStTools(config)).resolves.toBeUndefined();
    expect(
      (fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }])[0]
    ).toBe("https://hub.test/api/bot/tick");
  });
});
