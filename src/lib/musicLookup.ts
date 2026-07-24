export interface SongMatch {
  title: string;
  artistName: string;
  albumArtUrl: string | null;
  artistPictureUrl: string | null;
  trackUrl: string | null;
  source: "deezer" | "itunes";
}

const LOOKUP_TIMEOUT_MS = 5000;

function normalizeSearchQuery(entry: string): string {
  return entry
    .replace(/^["“]+|["”]+$/g, "")
    .replace(/\s+by\s+/i, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleMatch(entry: string, title: string, artistName: string): boolean {
  const normalizedEntry = entry.toLowerCase();
  return (
    normalizedEntry.includes(artistName.toLowerCase()) ||
    normalizedEntry.includes(title.toLowerCase())
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface DeezerSearchResponse {
  data?: Array<{
    title?: string;
    link?: string;
    artist?: { name?: string; picture_big?: string; picture_medium?: string };
    album?: { cover_big?: string; cover_medium?: string };
  }>;
}

async function searchDeezer(entry: string, query: string): Promise<SongMatch | null> {
  const url = `https://api.deezer.com/search?limit=1&q=${encodeURIComponent(query)}`;
  const json = (await fetchJson(url)) as DeezerSearchResponse | null;
  const track = json?.data?.[0];
  if (!track?.title || !track.artist?.name) {
    return null;
  }
  if (!isPlausibleMatch(entry, track.title, track.artist.name)) {
    return null;
  }

  return {
    title: track.title,
    artistName: track.artist.name,
    albumArtUrl: track.album?.cover_big ?? track.album?.cover_medium ?? null,
    artistPictureUrl: track.artist.picture_big ?? track.artist.picture_medium ?? null,
    trackUrl: track.link ?? null,
    source: "deezer",
  };
}

interface ItunesSearchResponse {
  results?: Array<{
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
  }>;
}

async function searchItunes(entry: string, query: string): Promise<SongMatch | null> {
  const url = `https://itunes.apple.com/search?limit=1&media=music&entity=song&term=${encodeURIComponent(query)}`;
  const json = (await fetchJson(url)) as ItunesSearchResponse | null;
  const track = json?.results?.[0];
  if (!track?.trackName || !track.artistName) {
    return null;
  }
  if (!isPlausibleMatch(entry, track.trackName, track.artistName)) {
    return null;
  }

  return {
    title: track.trackName,
    artistName: track.artistName,
    albumArtUrl: track.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
    artistPictureUrl: null,
    trackUrl: track.trackViewUrl ?? null,
    source: "itunes",
  };
}

export async function lookupSong(entry: string): Promise<SongMatch | null> {
  const query = normalizeSearchQuery(entry);
  if (!query) {
    return null;
  }

  const deezerMatch = await searchDeezer(entry, query);
  if (deezerMatch) {
    return deezerMatch;
  }

  return searchItunes(entry, query);
}
