import { describe, expect, it } from "vitest";
import { buildContributorEmbed, buildHeaderLine, chunkEmbeds } from "../src/lib/playlistEmbeds.js";
import type { SongMatch } from "../src/lib/musicLookup.js";
import { EmbedBuilder } from "discord.js";

const MATCH: SongMatch = {
  title: "Invincible",
  artistName: "DEAF KEV",
  albumArtUrl: "https://example.com/album.jpg",
  artistPictureUrl: "https://example.com/artist.jpg",
  trackUrl: "https://example.com/track",
  source: "deezer",
};

describe("buildHeaderLine", () => {
  it("includes the status suffix when present", () => {
    expect(
      buildHeaderLine(
        { weekNumber: 3, status: "DONE", entries: {}, contributorCount: 1, totalPeople: 2 },
        "📅 Weekly summary"
      )
    ).toBe("📅 Weekly summary — Week 3 (DONE)\n(1/2 contributed)");
  });

  it("omits the suffix when there's no status (e.g. a completed-week digest)", () => {
    expect(
      buildHeaderLine(
        { weekNumber: 1, entries: {}, contributorCount: 2, totalPeople: 2 },
        "✅ Week complete!"
      )
    ).toBe("✅ Week complete! — Week 1\n(2/2 contributed)");
  });
});

describe("buildContributorEmbed", () => {
  it("builds a rich embed with art and link when a match was found", () => {
    const embed = buildContributorEmbed("Sam", "DEAF KEV - Invincible", MATCH);
    const data = embed.toJSON();

    expect(data.author?.name).toBe("Sam");
    expect(data.title).toBe("Invincible — DEAF KEV");
    expect(data.url).toBe("https://example.com/track");
    expect(data.thumbnail?.url).toBe("https://example.com/album.jpg");
  });

  it("has no description when a match was found, regardless of how the entry was typed", () => {
    const embed = buildContributorEmbed("Sam", "invincible by deaf kev!!", MATCH);
    expect(embed.toJSON().description).toBeUndefined();
  });

  it("falls back to plain text with no thumbnail/link when no match was found", () => {
    const embed = buildContributorEmbed("Sam", "some untraceable entry", null);
    const data = embed.toJSON();

    expect(data.title).toBe("some untraceable entry");
    expect(data.description).toBe("No match found for this entry.");
    expect(data.thumbnail).toBeUndefined();
    expect(data.url).toBeUndefined();
  });
});

describe("chunkEmbeds", () => {
  it("returns an empty array for no embeds", () => {
    expect(chunkEmbeds([])).toEqual([]);
  });

  it("keeps up to 10 embeds in a single chunk", () => {
    const embeds = Array.from({ length: 10 }, () => new EmbedBuilder());
    expect(chunkEmbeds(embeds)).toHaveLength(1);
  });

  it("splits more than 10 embeds across multiple chunks", () => {
    const embeds = Array.from({ length: 12 }, () => new EmbedBuilder());
    const chunks = chunkEmbeds(embeds);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(2);
  });
});
