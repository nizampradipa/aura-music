import type {
  AlbumSummary,
  ArtistSummary,
  PlaybackDevice,
  Playlist,
  RepeatMode,
  SearchResults,
  Track,
  UserProfile,
} from '../types/music';
import { getValidAccessToken, refreshAccessToken } from './spotifyAuth';

const API_BASE = 'https://api.spotify.com/v1';

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface RawArtist {
  id: string;
  name: string;
  uri: string;
  external_urls?: { spotify?: string };
  images?: SpotifyImage[];
  genres?: string[];
}

interface RawAlbum {
  id: string;
  name: string;
  uri: string;
  images?: SpotifyImage[];
  release_date?: string;
  artists?: RawArtist[];
  external_urls?: { spotify?: string };
  total_tracks?: number;
}

interface RawTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  explicit?: boolean;
  external_urls?: { spotify?: string };
  artists?: RawArtist[];
  album?: RawAlbum;
}

interface RawPlaylist {
  id: string;
  uri: string;
  name: string;
  description?: string | null;
  images?: SpotifyImage[] | null;
  owner?: { id?: string; display_name?: string };
  collaborative?: boolean;
  public?: boolean;
  tracks?: { total?: number };
  items?: { total?: number };
  external_urls?: { spotify?: string };
}

function pickImage(images?: SpotifyImage[] | null): string {
  if (!images || images.length === 0) return '';
  return images[0]?.url || '';
}

export function mapArtist(raw: RawArtist): ArtistSummary {
  return {
    id: raw.id,
    name: raw.name,
    uri: raw.uri,
    externalUrl: raw.external_urls?.spotify,
    imageUrl: pickImage(raw.images),
    genres: raw.genres,
  };
}

export function mapAlbum(raw: RawAlbum): AlbumSummary {
  return {
    id: raw.id,
    name: raw.name,
    uri: raw.uri,
    imageUrl: pickImage(raw.images),
    releaseDate: raw.release_date,
    artists: (raw.artists || []).map(mapArtist),
    externalUrl: raw.external_urls?.spotify,
    totalTracks: raw.total_tracks,
  };
}

export function mapTrack(raw: RawTrack): Track {
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    durationMs: raw.duration_ms,
    explicit: raw.explicit,
    externalUrl: raw.external_urls?.spotify,
    artists: (raw.artists || []).map(mapArtist),
    album: raw.album
      ? mapAlbum(raw.album)
      : { id: '', name: '', uri: '', imageUrl: '', artists: [] },
  };
}

export function mapPlaylist(raw: RawPlaylist): Playlist {
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    description: raw.description || '',
    imageUrl: pickImage(raw.images),
    ownerId: raw.owner?.id || '',
    ownerName: raw.owner?.display_name || raw.owner?.id || 'Spotify',
    collaborative: Boolean(raw.collaborative),
    public: raw.public,
    tracksTotal: raw.tracks?.total ?? raw.items?.total ?? 0,
    externalUrl: raw.external_urls?.spotify,
  };
}

async function spotifyFetch<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  const token = await getValidAccessToken();
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 && attempt === 0) {
    await refreshAccessToken();
    return spotifyFetch<T>(path, init, 1);
  }

  if (res.status === 429 && attempt < 2) {
    const retryAfterSec = Number(res.headers.get('Retry-After') || '1');
    await new Promise((r) => setTimeout(r, Math.min(retryAfterSec * 1000, 5000)));
    return spotifyFetch<T>(path, init, attempt + 1);
  }

  if (res.status === 204 || res.status === 202) {
    return undefined as T;
  }

  if (!res.ok) {
    let message = `Spotify API ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) message = errJson.error.message;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const data = await spotifyFetch<{
    id: string;
    display_name?: string;
    email?: string;
    product?: string;
    images?: SpotifyImage[];
    external_urls?: { spotify?: string };
  }>('/me');

  return {
    id: data.id,
    displayName: data.display_name || data.id,
    email: data.email,
    product: data.product || 'free',
    imageUrl: pickImage(data.images),
    externalUrl: data.external_urls?.spotify,
  };
}

export async function searchCatalog(query: string, limit = 10): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { tracks: [], artists: [], albums: [], playlists: [] };
  }
  const params = new URLSearchParams({
    q: trimmed,
    type: 'track,artist,album,playlist',
    limit: String(limit),
  });
  const data = await spotifyFetch<{
    tracks?: { items: Array<RawTrack | null> };
    artists?: { items: Array<RawArtist | null> };
    albums?: { items: Array<RawAlbum | null> };
    playlists?: { items: Array<RawPlaylist | null> };
  }>(`/search?${params.toString()}`);

  return {
    tracks: (data.tracks?.items || []).filter((t): t is RawTrack => Boolean(t?.id)).map(mapTrack),
    artists: (data.artists?.items || []).filter((a): a is RawArtist => Boolean(a?.id)).map(mapArtist),
    albums: (data.albums?.items || []).filter((a): a is RawAlbum => Boolean(a?.id)).map(mapAlbum),
    playlists: (data.playlists?.items || []).filter((p): p is RawPlaylist => Boolean(p?.id)).map(mapPlaylist),
  };
}

export async function getMyPlaylists(limit = 40): Promise<Playlist[]> {
  const data = await spotifyFetch<{ items: Array<RawPlaylist | null> }>(`/me/playlists?limit=${limit}`);
  return (data.items || []).filter((p): p is RawPlaylist => Boolean(p?.id)).map(mapPlaylist);
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  // Spotify updated playlist item paths in 2026; support both `/tracks` and `/items` response shapes.
  const data = await spotifyFetch<{
    items: Array<{ track?: RawTrack | null; item?: RawTrack | null }>;
  }>(`/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`);

  return (data.items || [])
    .map((entry) => entry.track ?? entry.item)
    .filter((t): t is RawTrack => Boolean(t?.id && t.uri?.startsWith('spotify:track:')))
    .map(mapTrack);
}

export async function createPlaylist(
  userId: string,
  name: string,
  description = ''
): Promise<Playlist> {
  try {
    const raw = await spotifyFetch<RawPlaylist>('/me/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, public: false }),
    });
    return mapPlaylist(raw);
  } catch {
    const raw = await spotifyFetch<RawPlaylist>(`/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description, public: false }),
    });
    return mapPlaylist(raw);
  }
}

export async function updatePlaylistDetails(
  playlistId: string,
  name: string,
  description: string
): Promise<void> {
  await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris }),
  });
}

export async function removeTrackFromPlaylist(playlistId: string, uri: string): Promise<void> {
  await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'DELETE',
    body: JSON.stringify({ tracks: [{ uri }] }),
  });
}

export async function reorderPlaylistTrack(
  playlistId: string,
  rangeStart: number,
  insertBefore: number
): Promise<void> {
  await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({
      range_start: rangeStart,
      insert_before: insertBefore,
      range_length: 1,
    }),
  });
}

export async function getSavedTracks(limit = 40): Promise<Track[]> {
  const data = await spotifyFetch<{ items: Array<{ track?: RawTrack | null }> }>(`/me/tracks?limit=${limit}`);
  return (data.items || [])
    .map((entry) => entry.track)
    .filter((t): t is RawTrack => Boolean(t?.id))
    .map(mapTrack);
}

export async function getSavedAlbums(limit = 30): Promise<AlbumSummary[]> {
  const data = await spotifyFetch<{ items: Array<{ album?: RawAlbum | null }> }>(`/me/albums?limit=${limit}`);
  return (data.items || [])
    .map((entry) => entry.album)
    .filter((a): a is RawAlbum => Boolean(a?.id))
    .map(mapAlbum);
}

export async function getAlbumTracks(album: AlbumSummary): Promise<Track[]> {
  const data = await spotifyFetch<{ items: Array<RawTrack | null> }>(
    `/albums/${encodeURIComponent(album.id)}/tracks?limit=50`
  );
  return (data.items || [])
    .filter((t): t is RawTrack => Boolean(t?.id))
    .map((raw) => ({
      ...mapTrack(raw),
      album,
    }));
}

export async function getFollowedArtists(limit = 20): Promise<ArtistSummary[]> {
  const data = await spotifyFetch<{ artists?: { items: Array<RawArtist | null> } }>(
    `/me/following?type=artist&limit=${limit}`
  );
  return (data.artists?.items || []).filter((a): a is RawArtist => Boolean(a?.id)).map(mapArtist);
}

export async function checkTrackSaved(trackId: string): Promise<boolean> {
  try {
    const res = await spotifyFetch<boolean[]>(`/me/tracks/contains?ids=${encodeURIComponent(trackId)}`);
    return Boolean(res?.[0]);
  } catch {
    return false;
  }
}

export async function setTrackSaved(trackId: string, trackUri: string, save: boolean): Promise<void> {
  const method = save ? 'PUT' : 'DELETE';
  try {
    await spotifyFetch(`/me/library?uris=${encodeURIComponent(trackUri)}`, { method });
  } catch {
    await spotifyFetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, { method });
  }
}

export async function getDevices(): Promise<PlaybackDevice[]> {
  const data = await spotifyFetch<{
    devices: Array<{
      id: string | null;
      name: string;
      type: string;
      is_active: boolean;
      volume_percent: number | null;
    }>;
  }>('/me/player/devices');

  return (data.devices || [])
    .filter((d) => Boolean(d.id))
    .map((d) => ({
      id: d.id as string,
      name: d.name,
      type: d.type,
      isActive: d.is_active,
      volumePercent: d.volume_percent,
    }));
}

export async function getRemotePlaybackState(): Promise<{
  track: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  deviceId: string | null;
  deviceName: string | null;
} | null> {
  const data = await spotifyFetch<{
    is_playing: boolean;
    progress_ms: number | null;
    shuffle_state: boolean;
    repeat_state: RepeatMode;
    item?: RawTrack | null;
    device?: { id?: string | null; name?: string; volume_percent?: number | null };
  } | null>('/me/player');

  if (!data) return null;
  const track = data.item?.id ? mapTrack(data.item) : null;
  return {
    track,
    isPlaying: Boolean(data.is_playing),
    positionMs: data.progress_ms ?? 0,
    durationMs: track?.durationMs ?? 0,
    volume: typeof data.device?.volume_percent === 'number' ? data.device.volume_percent / 100 : 0.75,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state || 'off',
    deviceId: data.device?.id ?? null,
    deviceName: data.device?.name ?? null,
  };
}

export async function transferPlayback(deviceId: string, startPlaying = true): Promise<void> {
  await spotifyFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: startPlaying }),
  });
}

export async function playOnDevice(
  options: {
    deviceId?: string | null;
    uris?: string[];
    contextUri?: string;
    offsetUri?: string;
    positionMs?: number;
  } = {}
): Promise<void> {
  const query = options.deviceId ? `?device_id=${encodeURIComponent(options.deviceId)}` : '';
  const body: Record<string, unknown> = {};
  if (options.uris) body.uris = options.uris;
  if (options.contextUri) body.context_uri = options.contextUri;
  if (options.offsetUri) body.offset = { uri: options.offsetUri };
  if (typeof options.positionMs === 'number') body.position_ms = Math.floor(options.positionMs);

  await spotifyFetch(`/me/player/play${query}`, {
    method: 'PUT',
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
}

export async function pausePlayback(deviceId?: string | null): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  await spotifyFetch(`/me/player/pause${query}`, { method: 'PUT' });
}

export async function skipNext(deviceId?: string | null): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  await spotifyFetch(`/me/player/next${query}`, { method: 'POST' });
}

export async function skipPrevious(deviceId?: string | null): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  await spotifyFetch(`/me/player/previous${query}`, { method: 'POST' });
}

export async function seekPlayback(positionMs: number, deviceId?: string | null): Promise<void> {
  const params = new URLSearchParams({ position_ms: String(Math.max(0, Math.floor(positionMs))) });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyFetch(`/me/player/seek?${params.toString()}`, { method: 'PUT' });
}

export async function setPlaybackVolume(volume01: number, deviceId?: string | null): Promise<void> {
  const pct = Math.max(0, Math.min(100, Math.round(volume01 * 100)));
  const params = new URLSearchParams({ volume_percent: String(pct) });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyFetch(`/me/player/volume?${params.toString()}`, { method: 'PUT' });
}

export async function setPlaybackShuffle(state: boolean, deviceId?: string | null): Promise<void> {
  const params = new URLSearchParams({ state: String(state) });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyFetch(`/me/player/shuffle?${params.toString()}`, { method: 'PUT' });
}

export async function setPlaybackRepeat(state: RepeatMode, deviceId?: string | null): Promise<void> {
  const params = new URLSearchParams({ state });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyFetch(`/me/player/repeat?${params.toString()}`, { method: 'PUT' });
}

export async function getQueue(): Promise<{ current: Track | null; queue: Track[] }> {
  const data = await spotifyFetch<{
    currently_playing?: RawTrack | null;
    queue?: Array<RawTrack | null>;
  }>('/me/player/queue');

  return {
    current: data.currently_playing?.id ? mapTrack(data.currently_playing) : null,
    queue: (data.queue || [])
      .filter((t): t is RawTrack => Boolean(t?.id && t.uri?.startsWith('spotify:track:')))
      .map(mapTrack),
  };
}

export async function addToQueue(uri: string, deviceId?: string | null): Promise<void> {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyFetch(`/me/player/queue?${params.toString()}`, { method: 'POST' });
}
