export type RepeatMode = 'off' | 'context' | 'track';

export type MoodMode = 'focus' | 'chill' | 'night';

export type VisualizerStyle = 'flow' | 'orbit' | 'pulse';

export type VisualizerQuality = 'auto' | 'high' | 'low';

export type LyricsLayout = 'split' | 'overlay';

export type DrawerTab = 'search' | 'library' | 'queue';

export type SessionMode = 'landing' | 'demo' | 'spotify' | 'premium-required';

export interface ArtistSummary {
  id: string;
  name: string;
  uri: string;
  externalUrl?: string;
  imageUrl?: string;
  genres?: string[];
}

export interface AlbumSummary {
  id: string;
  name: string;
  uri: string;
  imageUrl: string;
  releaseDate?: string;
  artists: ArtistSummary[];
  externalUrl?: string;
  totalTracks?: number;
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: ArtistSummary[];
  album: AlbumSummary;
  durationMs: number;
  externalUrl?: string;
  explicit?: boolean;
  /** Optional musical chord progression for Demo Mode Web Audio synthesis */
  demoHarmony?: {
    rootMidi: number;
    chords: number[][];
    tempoSeconds: number;
  };
  /** Built-in synced LRC string for Demo Mode tracks */
  demoLrc?: string;
}

export interface Playlist {
  id: string;
  uri: string;
  name: string;
  description: string;
  imageUrl: string;
  ownerId: string;
  ownerName: string;
  collaborative: boolean;
  public?: boolean;
  tracksTotal: number;
  externalUrl?: string;
  /** Present in Demo Mode or once hydrated */
  tracks?: Track[];
}

export interface PlaybackDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number | null;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  product: 'premium' | 'free' | 'open' | string;
  imageUrl?: string;
  externalUrl?: string;
}

export interface PlaybackState {
  track: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number; // 0 to 1
  shuffle: boolean;
  repeat: RepeatMode;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  isRemoteControl: boolean;
  updatedAt: number;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsData {
  trackKey: string;
  synced: LyricLine[];
  plain: string | null;
  source: 'lrclib' | 'demo' | 'none';
  instrumental?: boolean;
}

export interface CoverPalette {
  dominant: string; // hex
  vibrant: string; // hex
  muted: string; // hex
  deep: string; // hex
  dominantRgb: [number, number, number];
  vibrantRgb: [number, number, number];
  mutedRgb: [number, number, number];
  deepRgb: [number, number, number];
}

export interface SearchResults {
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  playlists: Playlist[];
}

export interface ModePreset {
  id: MoodMode;
  label: string;
  summary: string;
  visualizer: VisualizerStyle;
  motionScale: number;
  brightness: number;
  warmth: number;
  autoHideMs: number;
  defaultLyricsOpen: boolean;
  linkedPlaylistId: string | null;
}
