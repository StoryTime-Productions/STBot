import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupSong } from "../src/lib/musicLookup.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("lookupSong", () => {
  it("returns a Deezer match when Deezer finds one, without calling iTunes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            title: "Invincible",
            link: "https://deezer.example/track/1",
            artist: { name: "DEAF KEV", picture_big: "https://deezer.example/artist.jpg" },
            album: { cover_big: "https://deezer.example/album.jpg" },
          },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong("DEAF KEV - Invincible");

    expect(match).toEqual({
      title: "Invincible",
      artistName: "DEAF KEV",
      albumArtUrl: "https://deezer.example/album.jpg",
      artistPictureUrl: "https://deezer.example/artist.jpg",
      trackUrl: "https://deezer.example/track/1",
      source: "deezer",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.deezer.com");
  });

  it("falls back to iTunes when Deezer returns no results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              trackName: "Saturn",
              artistName: "SZA",
              artworkUrl100: "https://itunes.example/100x100bb.jpg",
              trackViewUrl: "https://itunes.example/track",
            },
          ],
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong("SZA - Saturn");

    expect(match).toEqual({
      title: "Saturn",
      artistName: "SZA",
      albumArtUrl: "https://itunes.example/600x600bb.jpg",
      artistPictureUrl: null,
      trackUrl: "https://itunes.example/track",
      source: "itunes",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when neither API finds a match", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong("some completely made up gibberish song");

    expect(match).toBeNull();
  });

  it("returns null (not a throw) when the network call fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(lookupSong("DEAF KEV - Invincible")).resolves.toBeNull();
  });

  it("returns null (not a throw) on a non-2xx response", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false)) as unknown as typeof fetch;

    await expect(lookupSong("DEAF KEV - Invincible")).resolves.toBeNull();
  });

  it("rejects a Deezer result whose title/artist don't appear anywhere in the entry, falling back to iTunes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              // Real-world case: a mislabeled reupload matches on query terms
              // but is credited to a completely unrelated artist.
              title: "Invincible Glitch Hop",
              link: "https://deezer.example/wrong-track",
              artist: {
                name: "Electronic",
                picture_big: "https://deezer.example/wrong-artist.jpg",
              },
              album: { cover_big: "https://deezer.example/wrong-album.jpg" },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              trackName: "Invincible",
              artistName: "DEAF KEV",
              artworkUrl100: "https://itunes.example/100x100bb.jpg",
              trackViewUrl: "https://itunes.example/track",
            },
          ],
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong("DEAF KEV - Invincible");

    expect(match?.source).toBe("itunes");
    expect(match?.artistName).toBe("DEAF KEV");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null rather than an implausible match when both APIs return unrelated results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              title: "Telepath Piano Version",
              link: "https://deezer.example/wrong-track",
              artist: { name: "Piano Echoes" },
              album: {},
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              trackName: "Totally Different Song",
              artistName: "Someone Else",
              trackViewUrl: "https://itunes.example/track",
            },
          ],
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong('"Just a Sunny Day for You" by Yorushika');

    expect(match).toBeNull();
  });

  it("returns null for blank/empty entries without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const match = await lookupSong("   ");

    expect(match).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
