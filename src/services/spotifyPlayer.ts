import type { RepeatMode, Track } from '../types/music';
import { getValidAccessToken } from './spotifyAuth';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifySdkPlayer;
    };
  }
}

export interface SpotifySdkTrack {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: Array<{ name: string; uri: string }>;
  album: {
    name: string;
    uri: string;
    images: Array<{ url: string; width?: number; height?: number }>;
  };
}

export interface SpotifySdkState {
  paused: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat_mode: 0 | 1 | 2;
  track_window: {
    current_track: SpotifySdkTrack | null;
    next_tracks: SpotifySdkTrack[];
    previous_tracks: SpotifySdkTrack[];
  };
}

export interface SpotifySdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): void;
  addListener(event: 'player_state_changed', cb: (state: SpotifySdkState | null) => void): void;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    cb: (err: { message: string }) => void
  ): void;
  getCurrentState(): Promise<SpotifySdkState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  activateElement?(): Promise<void>;
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

export function isMobileOrUnsupportedForSdk(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isMobileUa || isIpadOs;
}

export function mapSdkTrack(sdkTrack: SpotifySdkTrack): Track {
  const albumId = sdkTrack.album.uri.split(':').pop() || '';
  return {
    id: sdkTrack.id || sdkTrack.uri.split(':').pop() || sdkTrack.uri,
    uri: sdkTrack.uri,
    name: sdkTrack.name,
    durationMs: sdkTrack.duration_ms,
    externalUrl: sdkTrack.id ? `https://open.spotify.com/track/${sdkTrack.id}` : undefined,
    artists: sdkTrack.artists.map((a) => ({
      id: a.uri.split(':').pop() || a.name,
      name: a.name,
      uri: a.uri,
    })),
    album: {
      id: albumId,
      name: sdkTrack.album.name,
      uri: sdkTrack.album.uri,
      imageUrl: sdkTrack.album.images[0]?.url || '',
      artists: [],
    },
  };
}

export function mapSdkRepeat(mode: 0 | 1 | 2): RepeatMode {
  if (mode === 1) return 'context';
  if (mode === 2) return 'track';
  return 'off';
}

let sdkLoadPromise: Promise<void> | null = null;

export function loadSpotifyWebPlaybackSdk(): Promise<void> {
  if (window.Spotify?.Player) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Spotify Web Playback SDK timed out while loading.'));
    }, 15000);

    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.src = SDK_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        sdkLoadPromise = null;
        reject(new Error('Could not load Spotify Web Playback SDK script.'));
      };
      document.body.appendChild(script);
    }
  });

  return sdkLoadPromise;
}

export interface WebPlayerCallbacks {
  onReady: (deviceId: string) => void;
  onNotReady: (deviceId: string) => void;
  onStateChange: (state: SpotifySdkState | null) => void;
  onError: (kind: 'init' | 'auth' | 'account' | 'playback', message: string) => void;
}

export async function createSpotifyWebPlayer(
  callbacks: WebPlayerCallbacks,
  initialVolume = 0.78
): Promise<SpotifySdkPlayer> {
  await loadSpotifyWebPlaybackSdk();
  if (!window.Spotify?.Player) {
    throw new Error('Spotify Web Playback SDK is unavailable in this browser.');
  }

  const player = new window.Spotify.Player({
    name: 'Aura Web Player',
    volume: initialVolume,
    getOAuthToken: (cb) => {
      getValidAccessToken()
        .then((token) => cb(token))
        .catch(() => cb(''));
    },
  });

  player.addListener('ready', ({ device_id }) => callbacks.onReady(device_id));
  player.addListener('not_ready', ({ device_id }) => callbacks.onNotReady(device_id));
  player.addListener('player_state_changed', (state) => callbacks.onStateChange(state));
  player.addListener('initialization_error', ({ message }) => callbacks.onError('init', message));
  player.addListener('authentication_error', ({ message }) => callbacks.onError('auth', message));
  player.addListener('account_error', ({ message }) => callbacks.onError('account', message));
  player.addListener('playback_error', ({ message }) => callbacks.onError('playback', message));

  const connected = await player.connect();
  if (!connected) {
    throw new Error('Could not connect Aura Web Player to Spotify.');
  }
  return player;
}

export function syncMediaSession(
  track: Track | null,
  isPlaying: boolean,
  handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrevious: () => void;
  }
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  if (track) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album.name,
      artwork: track.album.imageUrl
        ? [{ src: track.album.imageUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
  }

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  try {
    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);
  } catch {
    // Some browsers throw for unsupported action handlers
  }
}
