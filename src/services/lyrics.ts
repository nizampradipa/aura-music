import type { LyricLine, LyricsData, Track } from '../types/music';

const LRCLIB_BASE = 'https://lrclib.net/api';
const DB_NAME = 'aura-lyrics-cache';
const STORE_NAME = 'lyrics';
const OFFSET_STORAGE_KEY = 'aura.lyrics.offsets.v1';

const memoryCache = new Map<string, LyricsData>();

export function buildTrackLyricsKey(track: Track): string {
  const artist = track.artists[0]?.name || '';
  return `${artist.toLowerCase().trim()}::${track.name.toLowerCase().trim()}::${Math.round(
    track.durationMs / 1000
  )}`;
}

/**
 * Parses standard LRC synced lyric lines (`[mm:ss.xx] text`), including multi-timestamp lines.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lrc.split(/\r?\n/)) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(rawLine)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fractionRaw = match[3] || '0';
      const millis =
        fractionRaw.length === 1
          ? Number(fractionRaw) * 100
          : fractionRaw.length === 2
            ? Number(fractionRaw) * 10
            : Number(fractionRaw.slice(0, 3));
      timestamps.push((minutes * 60 + seconds) * 1000 + millis);
    }

    if (timestamps.length === 0) continue;
    const text = rawLine.replace(tagRegex, '').trim();
    for (const timeMs of timestamps) {
      lines.push({ timeMs, text });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function readIdbCache(trackKey: string): Promise<LyricsData | null> {
  try {
    const db = await openCacheDb();
    if (!db) return null;
    return await new Promise<LyricsData | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackKey);
      req.onsuccess = () => resolve((req.result as LyricsData | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIdbCache(record: LyricsData): Promise<void> {
  try {
    const db = await openCacheDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage errors
  }
}

export function getTrackLyricsOffsetMs(trackKey: string): number {
  try {
    const raw = localStorage.getItem(OFFSET_STORAGE_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    return typeof map[trackKey] === 'number' ? map[trackKey] : 0;
  } catch {
    return 0;
  }
}

export function setTrackLyricsOffsetMs(trackKey: string, offsetMs: number): void {
  try {
    const raw = localStorage.getItem(OFFSET_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (offsetMs === 0) {
      delete map[trackKey];
    } else {
      map[trackKey] = offsetMs;
    }
    localStorage.setItem(OFFSET_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

interface LrcLibResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
  duration?: number;
}

export async function fetchLyricsForTrack(track: Track): Promise<LyricsData> {
  const trackKey = buildTrackLyricsKey(track);

  // Demo tracks ship with built-in synced LRC
  if (track.demoLrc) {
    const parsed = parseLrc(track.demoLrc);
    return {
      trackKey,
      synced: parsed,
      plain: parsed.map((l) => l.text).join('\n'),
      source: 'demo',
    };
  }

  const mem = memoryCache.get(trackKey);
  if (mem) return mem;

  const cached = await readIdbCache(trackKey);
  if (cached) {
    memoryCache.set(trackKey, cached);
    return cached;
  }

  const artistName = track.artists[0]?.name || '';
  const durationSec = Math.round(track.durationMs / 1000);
  const headers: Record<string, string> = {
    'Lrclib-Client': 'Aura Web Player/0.1.0 (https://github.com/aura-player)',
  };

  let payload: LrcLibResponse | null = null;

  try {
    const exactParams = new URLSearchParams({
      track_name: track.name,
      artist_name: artistName,
      album_name: track.album.name,
      duration: String(durationSec),
    });
    const exactRes = await fetch(`${LRCLIB_BASE}/get?${exactParams.toString()}`, { headers });
    if (exactRes.ok) {
      payload = (await exactRes.json()) as LrcLibResponse;
    }
  } catch {
    // fall through to search
  }

  if (!payload || (!payload.syncedLyrics && !payload.plainLyrics && !payload.instrumental)) {
    try {
      const searchParams = new URLSearchParams({
        track_name: track.name,
        artist_name: artistName,
      });
      const searchRes = await fetch(`${LRCLIB_BASE}/search?${searchParams.toString()}`, {
        headers,
      });
      if (searchRes.ok) {
        const list = (await searchRes.json()) as LrcLibResponse[];
        if (Array.isArray(list) && list.length > 0) {
          payload =
            list.find((item) => Boolean(item.syncedLyrics) && Math.abs((item.duration || durationSec) - durationSec) <= 8) ||
            list.find((item) => Boolean(item.syncedLyrics)) ||
            list[0];
        }
      }
    } catch {
      // network unavailable
    }
  }

  const result: LyricsData = payload
    ? {
        trackKey,
        synced: payload.syncedLyrics ? parseLrc(payload.syncedLyrics) : [],
        plain: payload.plainLyrics || null,
        source: payload.syncedLyrics || payload.plainLyrics || payload.instrumental ? 'lrclib' : 'none',
        instrumental: Boolean(payload.instrumental),
      }
    : {
        trackKey,
        synced: [],
        plain: null,
        source: 'none',
      };

  memoryCache.set(trackKey, result);
  await writeIdbCache(result);
  return result;
}

export function findActiveLyricIndex(lines: LyricLine[], effectivePositionMs: number): number {
  if (lines.length === 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let match = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= effectivePositionMs) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return match;
}
