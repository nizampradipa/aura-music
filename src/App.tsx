import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODE_PRESETS, DEMO_ALBUMS, DEMO_ARTISTS, DEMO_TRACKS, INITIAL_DEMO_PLAYLISTS } from './data/demoCatalog';
import { DrawerPanel } from './components/DrawerPanel';
import { LyricsPane } from './components/LyricsPane';
import {
  LandingScreen,
  PremiumRequiredScreen,
  SettingsModal,
  ShortcutsModal,
} from './components/Overlays';
import { TopBar } from './components/TopBar';
import { TransportBar } from './components/TransportBar';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import {
  applyPaletteToRoot,
  DEFAULT_PALETTE,
  extractPaletteFromImage,
} from './services/colorExtract';
import { DemoAmbientSynth } from './services/demoAudio';
import {
  buildTrackLyricsKey,
  fetchLyricsForTrack,
  getTrackLyricsOffsetMs,
  setTrackLyricsOffsetMs,
} from './services/lyrics';
import {
  addToQueue,
  addTracksToPlaylist,
  checkTrackSaved,
  createPlaylist,
  getAlbumTracks,
  getCurrentUser,
  getDevices,
  getFollowedArtists,
  getMyPlaylists,
  getPlaylistTracks,
  getQueue,
  getRemotePlaybackState,
  getSavedAlbums,
  getSavedTracks,
  pausePlayback,
  playOnDevice,
  removeTrackFromPlaylist,
  reorderPlaylistTrack,
  searchCatalog,
  seekPlayback,
  setPlaybackRepeat,
  setPlaybackShuffle,
  setPlaybackVolume,
  setTrackSaved,
  skipNext,
  skipPrevious,
  transferPlayback,
  updatePlaylistDetails,
} from './services/spotifyApi';
import {
  beginSpotifyLogin,
  clearStoredTokens,
  handleSpotifyCallback,
  readStoredTokens,
} from './services/spotifyAuth';
import {
  createSpotifyWebPlayer,
  isMobileOrUnsupportedForSdk,
  mapSdkRepeat,
  mapSdkTrack,
  syncMediaSession,
  type SpotifySdkPlayer,
} from './services/spotifyPlayer';
import type {
  AlbumSummary,
  ArtistSummary,
  CoverPalette,
  DrawerTab,
  LyricsData,
  LyricsLayout,
  ModePreset,
  MoodMode,
  PlaybackDevice,
  PlaybackState,
  Playlist,
  RepeatMode,
  SearchResults,
  SessionMode,
  Track,
  UserProfile,
  VisualizerQuality,
  VisualizerStyle,
} from './types/music';

const EMPTY_SEARCH: SearchResults = { tracks: [], artists: [], albums: [], playlists: [] };

function formatCountdown(totalSec: number | null): string | null {
  if (totalSec === null || totalSec <= 0) return null;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function App() {
  const [sessionMode, setSessionMode] = useState<SessionMode>('landing');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Atmosphere & preferences
  const [mode, setMode] = useState<MoodMode>('chill');
  const [presets, setPresets] = useState<Record<MoodMode, ModePreset>>(DEFAULT_MODE_PRESETS);
  const [visualizer, setVisualizer] = useState<VisualizerStyle>('flow');
  const [quality, setQuality] = useState<VisualizerQuality>('auto');
  const [palette, setPalette] = useState<CoverPalette>(DEFAULT_PALETTE);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [lyricsLayout, setLyricsLayout] = useState<LyricsLayout>('split');

  // Chrome & panels
  const [chromeVisible, setChromeVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('library');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Playback state
  const [playback, setPlayback] = useState<PlaybackState>({
    track: DEMO_TRACKS[0],
    isPlaying: false,
    positionMs: 0,
    durationMs: DEMO_TRACKS[0].durationMs,
    volume: 0.76,
    shuffle: false,
    repeat: 'context',
    activeDeviceId: null,
    activeDeviceName: null,
    isRemoteControl: false,
    updatedAt: Date.now(),
  });

  // Spotify SDK refs
  const sdkPlayerRef = useRef<SpotifySdkPlayer | null>(null);
  const sdkDeviceIdRef = useRef<string | null>(null);
  const [devices, setDevices] = useState<PlaybackDevice[]>([]);
  const [remoteBanner, setRemoteBanner] = useState<string | null>(null);

  // Demo Mode state & synth
  const synthRef = useRef<DemoAmbientSynth | null>(null);
  const [demoSynthMuted, setDemoSynthMuted] = useState(false);
  const [demoContextTracks, setDemoContextTracks] = useState<Track[]>(DEMO_TRACKS);
  const [queue, setQueue] = useState<Track[]>([DEMO_TRACKS[1], DEMO_TRACKS[2], DEMO_TRACKS[3]]);

  // Library & Search state
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_DEMO_PLAYLISTS);
  const [likedTracks, setLikedTracks] = useState<Track[]>([DEMO_TRACKS[0], DEMO_TRACKS[1], DEMO_TRACKS[4]]);
  const [savedAlbums, setSavedAlbums] = useState<AlbumSummary[]>(DEMO_ALBUMS);
  const [followedArtists, setFollowedArtists] = useState<ArtistSummary[]>(DEMO_ARTISTS);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [selectedPlaylistLoading, setSelectedPlaylistLoading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSummary | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_SEARCH);
  const [searchLoading, setSearchLoading] = useState(false);

  // Lyrics state
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);

  // Timers (Focus Pomodoro & Night Sleep)
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number | null>(null);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const preSleepVolumeRef = useRef<number | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const likedIds = useMemo(() => new Set(likedTracks.map((t) => t.id)), [likedTracks]);

  // Ensure DemoAmbientSynth instance
  useEffect(() => {
    const synth = new DemoAmbientSynth();
    synthRef.current = synth;
    return () => {
      synth.dispose();
      synthRef.current = null;
    };
  }, []);

  // Load live Spotify user library once authenticated
  const hydrateSpotifyLibrary = useCallback(async () => {
    try {
      const [pls, saved, albums, artists, q] = await Promise.all([
        getMyPlaylists(40),
        getSavedTracks(40),
        getSavedAlbums(24),
        getFollowedArtists(20),
        getQueue().catch(() => ({ current: null, queue: [] })),
      ]);
      setPlaylists(pls);
      setLikedTracks(saved);
      setSavedAlbums(albums);
      setFollowedArtists(artists);
      if (q.queue.length > 0) setQueue(q.queue);
      setPresets((prev) => ({
        focus: { ...prev.focus, linkedPlaylistId: null },
        chill: { ...prev.chill, linkedPlaylistId: null },
        night: { ...prev.night, linkedPlaylistId: null },
      }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load full Spotify library.');
    }
  }, [showToast]);

  // Boot: handle OAuth callback or restore existing sessionStorage tokens
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      const url = new URL(window.location.href);
      const isCallback = url.pathname.endsWith('/callback') || url.searchParams.has('code') || url.searchParams.has('error');

      if (isCallback) {
        try {
          await handleSpotifyCallback(url.searchParams);
          window.history.replaceState({}, document.title, '/');
        } catch (err) {
          window.history.replaceState({}, document.title, '/');
          if (!cancelled) {
            setAuthError(err instanceof Error ? err.message : 'Spotify sign-in failed.');
            setSessionMode('landing');
          }
          return;
        }
      }

      const tokens = readStoredTokens();
      if (!tokens) return;

      try {
        const profile = await getCurrentUser();
        if (cancelled) return;
        setUser(profile);
        if (profile.product !== 'premium') {
          setSessionMode('premium-required');
          return;
        }
        setSessionMode('spotify');
        void hydrateSpotifyLibrary();
      } catch (err) {
        clearStoredTokens();
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : 'Session expired. Sign in again.');
          setSessionMode('landing');
        }
      }
    };

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, [hydrateSpotifyLibrary]);

  // Initialize Spotify Web Playback SDK or Remote Control fallback
  useEffect(() => {
    if (sessionMode !== 'spotify') {
      if (sdkPlayerRef.current) {
        sdkPlayerRef.current.disconnect();
        sdkPlayerRef.current = null;
        sdkDeviceIdRef.current = null;
      }
      setRemoteBanner(null);
      return;
    }

    let cancelled = false;
    const forceRemote = isMobileOrUnsupportedForSdk();

    const syncRemoteNow = async () => {
      try {
        const [state, devList] = await Promise.all([
          getRemotePlaybackState(),
          getDevices().catch(() => []),
        ]);
        if (cancelled) return;
        setDevices(devList);
        if (state) {
          const onBrowser = Boolean(sdkDeviceIdRef.current && state.deviceId === sdkDeviceIdRef.current);
          setPlayback((prev) => ({
            ...prev,
            track: state.track ?? prev.track,
            isPlaying: state.isPlaying,
            positionMs: state.positionMs,
            durationMs: state.durationMs || prev.durationMs,
            volume: state.volume,
            shuffle: state.shuffle,
            repeat: state.repeat,
            activeDeviceId: state.deviceId,
            activeDeviceName: state.deviceName,
            isRemoteControl: !onBrowser,
            updatedAt: Date.now(),
          }));
        }
      } catch {
        // transient network hiccup
      }
    };

    if (forceRemote) {
      setRemoteBanner('Mobile browser detected — controlling your active Spotify app remotely.');
      setPlayback((p) => ({ ...p, isRemoteControl: true }));
      void syncRemoteNow();
    } else {
      createSpotifyWebPlayer(
        {
          onReady: (deviceId) => {
            if (cancelled) return;
            sdkDeviceIdRef.current = deviceId;
            setRemoteBanner(null);
            setPlayback((p) => ({
              ...p,
              activeDeviceId: p.activeDeviceId || deviceId,
              activeDeviceName: p.activeDeviceName || 'Aura Web Player',
              isRemoteControl: false,
            }));
            void getDevices().then((d) => !cancelled && setDevices(d)).catch(() => {});
            void syncRemoteNow();
          },
          onNotReady: () => {
            if (!cancelled) {
              setRemoteBanner('Aura Web Player disconnected — using remote control.');
            }
          },
          onStateChange: (sdkState) => {
            if (cancelled || !sdkState) return;
            const current = sdkState.track_window.current_track
              ? mapSdkTrack(sdkState.track_window.current_track)
              : null;
            const upcoming = sdkState.track_window.next_tracks.map(mapSdkTrack);
            setPlayback((prev) => ({
              ...prev,
              track: current ?? prev.track,
              isPlaying: !sdkState.paused,
              positionMs: sdkState.position,
              durationMs: sdkState.duration || current?.durationMs || prev.durationMs,
              shuffle: sdkState.shuffle,
              repeat: mapSdkRepeat(sdkState.repeat_mode),
              activeDeviceId: sdkDeviceIdRef.current,
              activeDeviceName: 'Aura Web Player',
              isRemoteControl: false,
              updatedAt: Date.now(),
            }));
            if (upcoming.length > 0) setQueue(upcoming);
          },
          onError: (kind, message) => {
            if (cancelled) return;
            if (kind === 'account') {
              setSessionMode('premium-required');
            } else {
              setRemoteBanner(`Browser player unavailable (${message}) — switched to remote control.`);
            }
          },
        },
        playback.volume
      )
        .then((player) => {
          if (cancelled) {
            player.disconnect();
          } else {
            sdkPlayerRef.current = player;
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteBanner('Browser playback unavailable here — controlling active Spotify device remotely.');
          }
        });
    }

    // Light background sync every 3s to catch device transfers or remote playback
    const pollId = window.setInterval(() => {
      if (!document.hidden) void syncRemoteNow();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      if (sdkPlayerRef.current) {
        sdkPlayerRef.current.disconnect();
        sdkPlayerRef.current = null;
        sdkDeviceIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionMode]);

  // Extract cover palette & crossfade CSS custom properties whenever track art changes
  useEffect(() => {
    const imgUrl = playback.track?.album.imageUrl;
    if (!imgUrl) return;
    let cancelled = false;
    void extractPaletteFromImage(imgUrl).then((nextPalette) => {
      if (cancelled) return;
      setPalette(nextPalette);
      applyPaletteToRoot(nextPalette);
    });
    return () => {
      cancelled = true;
    };
  }, [playback.track?.album.imageUrl]);

  // Fetch synced lyrics whenever active track changes
  useEffect(() => {
    const track = playback.track;
    if (!track) {
      setLyrics(null);
      return;
    }
    let cancelled = false;
    const trackKey = buildTrackLyricsKey(track);
    setLyricsOffsetMs(getTrackLyricsOffsetMs(trackKey));
    setLyricsLoading(true);

    void fetchLyricsForTrack(track).then((data) => {
      if (cancelled) return;
      setLyrics(data);
      setLyricsLoading(false);
    });

    if (sessionMode === 'spotify') {
      void checkTrackSaved(track.id).then((saved) => {
        if (cancelled) return;
        setLikedTracks((prev) => {
          const exists = prev.some((t) => t.id === track.id);
          if (saved && !exists) return [track, ...prev];
          if (!saved && exists) return prev.filter((t) => t.id !== track.id);
          return prev;
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [playback.track?.id, sessionMode]);

  // Keep DemoAmbientSynth synchronized in Demo Mode
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;
    if (sessionMode !== 'demo') {
      synth.setPlaying(false);
      return;
    }
    synth.setTrack(playback.track);
    synth.setVolume(playback.volume);
    synth.setPlaying(playback.isPlaying);
  }, [sessionMode, playback.track, playback.isPlaying, playback.volume]);

  // Playback actions
  const advanceDemoTrack = useCallback(
    (direction: 1 | -1) => {
      setPlayback((prev) => {
        if (!prev.track) return prev;
        if (direction === -1 && prev.positionMs > 4000) {
          return { ...prev, positionMs: 0, updatedAt: Date.now() };
        }
        if (direction === 1 && prev.repeat === 'track') {
          return { ...prev, positionMs: 0, updatedAt: Date.now() };
        }
        if (direction === 1 && queue.length > 0) {
          const [nextFromQueue, ...rest] = queue;
          setQueue(rest);
          return {
            ...prev,
            track: nextFromQueue,
            positionMs: 0,
            durationMs: nextFromQueue.durationMs,
            isPlaying: true,
            updatedAt: Date.now(),
          };
        }
        const list = demoContextTracks.length > 0 ? demoContextTracks : DEMO_TRACKS;
        const idx = list.findIndex((t) => t.id === prev.track?.id);
        let nextIdx = idx;
        if (prev.shuffle && list.length > 1) {
          while (nextIdx === idx) {
            nextIdx = Math.floor(Math.random() * list.length);
          }
        } else {
          nextIdx = (idx + direction + list.length) % list.length;
        }
        const nextTrack = list[nextIdx] || DEMO_TRACKS[0];
        return {
          ...prev,
          track: nextTrack,
          positionMs: 0,
          durationMs: nextTrack.durationMs,
          isPlaying: true,
          updatedAt: Date.now(),
        };
      });
    },
    [demoContextTracks, queue]
  );

  // Smooth 200ms position ticker for both Demo Mode and interpolated Spotify Mode
  useEffect(() => {
    if (!playback.isPlaying || sessionMode === 'landing' || sessionMode === 'premium-required') {
      return;
    }
    const id = window.setInterval(() => {
      setPlayback((prev) => {
        if (!prev.isPlaying || !prev.track) return prev;
        const now = Date.now();
        const elapsed = now - prev.updatedAt;
        const nextPos = prev.positionMs + elapsed;
        if (sessionMode === 'demo' && nextPos >= prev.durationMs) {
          window.setTimeout(() => advanceDemoTrack(1), 0);
          return { ...prev, positionMs: prev.durationMs, updatedAt: now };
        }
        return {
          ...prev,
          positionMs: Math.min(nextPos, prev.durationMs),
          updatedAt: now,
        };
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [playback.isPlaying, sessionMode, advanceDemoTrack]);

  const handleTogglePlay = useCallback(async () => {
    if (sessionMode === 'demo') {
      setPlayback((p) => ({ ...p, isPlaying: !p.isPlaying, updatedAt: Date.now() }));
      return;
    }
    if (sessionMode !== 'spotify') return;
    try {
      if (!playback.isRemoteControl && sdkPlayerRef.current) {
        if (sdkPlayerRef.current.activateElement) {
          await sdkPlayerRef.current.activateElement();
        }
        await sdkPlayerRef.current.togglePlay();
      } else if (playback.isPlaying) {
        await pausePlayback(playback.activeDeviceId);
        setPlayback((p) => ({ ...p, isPlaying: false, updatedAt: Date.now() }));
      } else {
        await playOnDevice({ deviceId: playback.activeDeviceId ?? sdkDeviceIdRef.current });
        setPlayback((p) => ({ ...p, isPlaying: true, updatedAt: Date.now() }));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to toggle playback.');
    }
  }, [sessionMode, playback.isRemoteControl, playback.isPlaying, playback.activeDeviceId, showToast]);

  const handleNext = useCallback(async () => {
    if (sessionMode === 'demo') {
      advanceDemoTrack(1);
      return;
    }
    try {
      if (!playback.isRemoteControl && sdkPlayerRef.current) {
        await sdkPlayerRef.current.nextTrack();
      } else {
        await skipNext(playback.activeDeviceId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not skip to next track.');
    }
  }, [sessionMode, advanceDemoTrack, playback.isRemoteControl, playback.activeDeviceId, showToast]);

  const handlePrevious = useCallback(async () => {
    if (sessionMode === 'demo') {
      advanceDemoTrack(-1);
      return;
    }
    try {
      if (!playback.isRemoteControl && sdkPlayerRef.current) {
        await sdkPlayerRef.current.previousTrack();
      } else {
        await skipPrevious(playback.activeDeviceId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not skip to previous track.');
    }
  }, [sessionMode, advanceDemoTrack, playback.isRemoteControl, playback.activeDeviceId, showToast]);

  const handleSeek = useCallback(
    async (positionMs: number) => {
      const clamped = Math.max(0, Math.min(positionMs, playback.durationMs));
      setPlayback((p) => ({ ...p, positionMs: clamped, updatedAt: Date.now() }));
      if (sessionMode !== 'spotify') return;
      try {
        if (!playback.isRemoteControl && sdkPlayerRef.current) {
          await sdkPlayerRef.current.seek(clamped);
        } else {
          await seekPlayback(clamped, playback.activeDeviceId);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Seek failed.');
      }
    },
    [playback.durationMs, playback.isRemoteControl, playback.activeDeviceId, sessionMode, showToast]
  );

  const handleChangeVolume = useCallback(
    async (vol01: number) => {
      const clamped = Math.max(0, Math.min(1, vol01));
      setPlayback((p) => ({ ...p, volume: clamped }));
      if (sessionMode !== 'spotify') return;
      try {
        if (!playback.isRemoteControl && sdkPlayerRef.current) {
          await sdkPlayerRef.current.setVolume(clamped);
        } else {
          await setPlaybackVolume(clamped, playback.activeDeviceId);
        }
      } catch {
        // ignore unsupported device volume errors
      }
    },
    [sessionMode, playback.isRemoteControl, playback.activeDeviceId]
  );

  const handleToggleShuffle = useCallback(async () => {
    const next = !playback.shuffle;
    setPlayback((p) => ({ ...p, shuffle: next }));
    if (sessionMode !== 'spotify') return;
    try {
      await setPlaybackShuffle(next, playback.activeDeviceId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Shuffle update failed.');
    }
  }, [playback.shuffle, playback.activeDeviceId, sessionMode, showToast]);

  const handleCycleRepeat = useCallback(async () => {
    const order: RepeatMode[] = ['off', 'context', 'track'];
    const next = order[(order.indexOf(playback.repeat) + 1) % order.length];
    setPlayback((p) => ({ ...p, repeat: next }));
    if (sessionMode !== 'spotify') return;
    try {
      await setPlaybackRepeat(next, playback.activeDeviceId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Repeat update failed.');
    }
  }, [playback.repeat, playback.activeDeviceId, sessionMode, showToast]);

  const handlePlayTrack = useCallback(
    async (track: Track, contextTracks?: Track[], contextUri?: string) => {
      if (sessionMode === 'demo') {
        if (contextTracks && contextTracks.length > 0) {
          setDemoContextTracks(contextTracks);
          const idx = contextTracks.findIndex((t) => t.id === track.id);
          if (idx >= 0) {
            setQueue(contextTracks.slice(idx + 1, idx + 5));
          }
        }
        setPlayback((p) => ({
          ...p,
          track,
          positionMs: 0,
          durationMs: track.durationMs,
          isPlaying: true,
          updatedAt: Date.now(),
        }));
        return;
      }

      if (sessionMode !== 'spotify') return;
      const targetDevice = sdkDeviceIdRef.current || playback.activeDeviceId;
      try {
        if (sdkPlayerRef.current?.activateElement) {
          await sdkPlayerRef.current.activateElement();
        }
        if (contextUri) {
          await playOnDevice({ deviceId: targetDevice, contextUri, offsetUri: track.uri });
        } else {
          const uris = contextTracks
            ? contextTracks.slice(Math.max(0, contextTracks.findIndex((t) => t.id === track.id))).map((t) => t.uri)
            : [track.uri];
          await playOnDevice({ deviceId: targetDevice, uris });
        }
        setPlayback((p) => ({
          ...p,
          track,
          positionMs: 0,
          durationMs: track.durationMs,
          isPlaying: true,
          updatedAt: Date.now(),
        }));
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not start playback on device.');
      }
    },
    [sessionMode, playback.activeDeviceId, showToast]
  );

  // Sync OS Media Session
  useEffect(() => {
    if (sessionMode !== 'demo' && sessionMode !== 'spotify') return;
    syncMediaSession(playback.track, playback.isPlaying, {
      onPlay: () => {
        if (!playback.isPlaying) void handleTogglePlay();
      },
      onPause: () => {
        if (playback.isPlaying) void handleTogglePlay();
      },
      onNext: () => void handleNext(),
      onPrevious: () => void handlePrevious(),
    });
  }, [sessionMode, playback.track, playback.isPlaying, handleTogglePlay, handleNext, handlePrevious]);

  // Mood mode switching (applies visualizer, lyrics visibility, and optional linked playlist)
  const handleSelectMode = useCallback(
    async (nextMode: MoodMode) => {
      const preset = presets[nextMode];
      setMode(nextMode);
      setVisualizer(preset.visualizer);
      setLyricsOpen(preset.defaultLyricsOpen);

      if (preset.linkedPlaylistId) {
        const linked = playlists.find((p) => p.id === preset.linkedPlaylistId);
        if (linked) {
          if (sessionMode === 'demo' && linked.tracks && linked.tracks.length > 0) {
            await handlePlayTrack(linked.tracks[0], linked.tracks, linked.uri);
            showToast(`${preset.label} mode · Playing ${linked.name}`);
            return;
          }
          if (sessionMode === 'spotify') {
            try {
              await playOnDevice({
                deviceId: sdkDeviceIdRef.current || playback.activeDeviceId,
                contextUri: linked.uri,
              });
              showToast(`${preset.label} mode · Playing ${linked.name}`);
              return;
            } catch {
              // ignore if no device ready yet
            }
          }
        }
      }
      showToast(`${preset.label} mode`);
    },
    [presets, playlists, sessionMode, playback.activeDeviceId, handlePlayTrack, showToast]
  );

  // Focus Pomodoro countdown
  useEffect(() => {
    if (focusSecondsLeft === null) return;
    if (focusSecondsLeft <= 0) {
      setFocusSecondsLeft(null);
      showToast('Focus session complete — take a short break.');
      return;
    }
    const id = window.setInterval(() => {
      setFocusSecondsLeft((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusSecondsLeft, showToast]);

  // Night Sleep Timer countdown with smooth 20s fade-out before pausing
  useEffect(() => {
    if (sleepSecondsLeft === null) return;
    if (sleepSecondsLeft <= 0) {
      setSleepSecondsLeft(null);
      if (playback.isPlaying) void handleTogglePlay();
      if (preSleepVolumeRef.current !== null) {
        void handleChangeVolume(preSleepVolumeRef.current);
        preSleepVolumeRef.current = null;
      }
      showToast('Sleep timer finished — playback paused.');
      return;
    }

    if (sleepSecondsLeft <= 20) {
      if (preSleepVolumeRef.current === null) {
        preSleepVolumeRef.current = playback.volume;
      }
      const targetVol = (preSleepVolumeRef.current || 0.7) * (sleepSecondsLeft / 20);
      void handleChangeVolume(targetVol);
    }

    const id = window.setInterval(() => {
      setSleepSecondsLeft((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepSecondsLeft, playback.isPlaying, playback.volume, handleTogglePlay, handleChangeVolume, showToast]);

  // Debounced search (300ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(EMPTY_SEARCH);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const id = window.setTimeout(async () => {
      if (sessionMode === 'demo') {
        const q = trimmed.toLowerCase();
        setSearchResults({
          tracks: DEMO_TRACKS.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.artists.some((a) => a.name.toLowerCase().includes(q)) ||
              t.album.name.toLowerCase().includes(q)
          ),
          artists: DEMO_ARTISTS.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.genres?.some((g) => g.toLowerCase().includes(q))
          ),
          albums: DEMO_ALBUMS.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.artists.some((ar) => ar.name.toLowerCase().includes(q))
          ),
          playlists: playlists.filter(
            (p) =>
              p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
          ),
        });
        setSearchLoading(false);
        return;
      }

      if (sessionMode === 'spotify') {
        try {
          const res = await searchCatalog(trimmed, 10);
          setSearchResults(res);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Search failed.');
        } finally {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(id);
  }, [searchQuery, sessionMode, playlists, showToast]);

  // Hydrate playlist or album detail when selected
  useEffect(() => {
    if (!selectedPlaylist) {
      setSelectedPlaylistTracks([]);
      return;
    }
    if (sessionMode === 'demo') {
      const live = playlists.find((p) => p.id === selectedPlaylist.id);
      setSelectedPlaylistTracks(live?.tracks || []);
      return;
    }
    let cancelled = false;
    setSelectedPlaylistLoading(true);
    void getPlaylistTracks(selectedPlaylist.id)
      .then((tracks) => {
        if (!cancelled) setSelectedPlaylistTracks(tracks);
      })
      .catch((err) => {
        if (!cancelled) showToast(err instanceof Error ? err.message : 'Could not load playlist.');
      })
      .finally(() => {
        if (!cancelled) setSelectedPlaylistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylist, sessionMode, playlists, showToast]);

  useEffect(() => {
    if (!selectedAlbum) {
      setSelectedAlbumTracks([]);
      return;
    }
    if (sessionMode === 'demo') {
      setSelectedAlbumTracks(DEMO_TRACKS.filter((t) => t.album.id === selectedAlbum.id));
      return;
    }
    let cancelled = false;
    void getAlbumTracks(selectedAlbum)
      .then((tracks) => {
        if (!cancelled) setSelectedAlbumTracks(tracks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAlbum, sessionMode]);

  // Auto-hide ambient chrome when idle during playback
  useEffect(() => {
    if (sessionMode !== 'demo' && sessionMode !== 'spotify') return;
    let hideTimer: number | null = null;

    const scheduleHide = () => {
      setChromeVisible(true);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (drawerOpen || settingsOpen || shortcutsOpen || !playback.isPlaying) return;
      const delay = isFullscreen ? Math.min(2400, presets[mode].autoHideMs) : presets[mode].autoHideMs;
      hideTimer = window.setTimeout(() => setChromeVisible(false), delay);
    };

    scheduleHide();
    const events: Array<keyof WindowEventMap> = ['pointermove', 'pointerdown', 'keydown'];
    events.forEach((ev) => window.addEventListener(ev, scheduleHide, { passive: true }));
    return () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      events.forEach((ev) => window.removeEventListener(ev, scheduleHide));
    };
  }, [sessionMode, drawerOpen, settingsOpen, shortcutsOpen, playback.isPlaying, isFullscreen, mode, presets]);

  // Track browser fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        setIsFullscreen((v) => !v);
      });
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    if (sessionMode !== 'demo' && sessionMode !== 'spotify') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (drawerOpen) setDrawerOpen(false);
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        return;
      }

      if (isInput) return;

      if (e.key === ' ') {
        e.preventDefault();
        void handleTogglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        void handleSeek(playback.positionMs + 10000);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void handleSeek(playback.positionMs - 10000);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        void handleChangeVolume(playback.volume + 0.05);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        void handleChangeVolume(playback.volume - 0.05);
      } else if (e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        setLyricsOpen((v) => !v);
      } else if (e.key === 'L' && e.shiftKey) {
        e.preventDefault();
        setLyricsOpen(true);
        setLyricsLayout((prev) => (prev === 'split' ? 'overlay' : 'split'));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const order: MoodMode[] = ['focus', 'chill', 'night'];
        const next = order[(order.indexOf(mode) + 1) % order.length];
        void handleSelectMode(next);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === '/') {
        e.preventDefault();
        setDrawerTab('search');
        setDrawerOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    sessionMode,
    shortcutsOpen,
    settingsOpen,
    drawerOpen,
    playback.positionMs,
    playback.volume,
    mode,
    handleTogglePlay,
    handleSeek,
    handleChangeVolume,
    handleSelectMode,
    handleToggleFullscreen,
  ]);

  // Library mutations (work seamlessly in both Demo Mode and Spotify Mode)
  const handleToggleLikeTrack = useCallback(
    async (track: Track) => {
      const currentlyLiked = likedIds.has(track.id);
      setLikedTracks((prev) =>
        currentlyLiked ? prev.filter((t) => t.id !== track.id) : [track, ...prev]
      );
      if (sessionMode === 'spotify') {
        try {
          await setTrackSaved(track.id, track.uri, !currentlyLiked);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not update saved track.');
        }
      }
      showToast(currentlyLiked ? `Removed "${track.name}" from Liked` : `Saved "${track.name}"`);
    },
    [likedIds, sessionMode, showToast]
  );

  const handleAddToQueue = useCallback(
    async (track: Track) => {
      setQueue((prev) => [...prev, track]);
      if (sessionMode === 'spotify') {
        try {
          await addToQueue(track.uri, playback.activeDeviceId);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not add track to Spotify queue.');
          return;
        }
      }
      showToast(`Added "${track.name}" to queue`);
    },
    [sessionMode, playback.activeDeviceId, showToast]
  );

  const handleCreatePlaylist = useCallback(
    async (name: string, description: string) => {
      if (sessionMode === 'demo') {
        const created: Playlist = {
          id: `pl-${Date.now()}`,
          uri: `spotify:playlist:demo_${Date.now()}`,
          name,
          description,
          imageUrl: playback.track?.album.imageUrl || DEMO_TRACKS[0].album.imageUrl,
          ownerId: 'demo-user',
          ownerName: 'You',
          collaborative: false,
          tracksTotal: 0,
          tracks: [],
        };
        setPlaylists((prev) => [created, ...prev]);
        setSelectedPlaylist(created);
        showToast(`Created "${name}"`);
        return;
      }

      if (!user) return;
      try {
        const created = await createPlaylist(user.id, name, description);
        setPlaylists((prev) => [created, ...prev]);
        setSelectedPlaylist(created);
        showToast(`Created "${name}"`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create playlist.');
      }
    },
    [sessionMode, playback.track, user, showToast]
  );

  const handleUpdatePlaylist = useCallback(
    async (playlistId: string, name: string, description: string) => {
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, name, description } : p))
      );
      setSelectedPlaylist((prev) =>
        prev && prev.id === playlistId ? { ...prev, name, description } : prev
      );
      if (sessionMode === 'spotify') {
        try {
          await updatePlaylistDetails(playlistId, name, description);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not update playlist details.');
          return;
        }
      }
      showToast('Playlist details saved');
    },
    [sessionMode, showToast]
  );

  const handleAddTrackToPlaylist = useCallback(
    async (playlistId: string, track: Track) => {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                tracksTotal: (p.tracks?.length ?? p.tracksTotal) + 1,
                tracks: p.tracks ? [...p.tracks, track] : undefined,
              }
            : p
        )
      );
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylistTracks((prev) => [...prev, track]);
      }
      if (sessionMode === 'spotify') {
        try {
          await addTracksToPlaylist(playlistId, [track.uri]);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not add track to playlist.');
          return;
        }
      }
      showToast(`Added "${track.name}" to playlist`);
    },
    [selectedPlaylist, sessionMode, showToast]
  );

  const handleRemoveTrackFromPlaylist = useCallback(
    async (playlistId: string, track: Track, index: number) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          const nextTracks = p.tracks ? p.tracks.filter((_, i) => i !== index) : undefined;
          return {
            ...p,
            tracks: nextTracks,
            tracksTotal: Math.max(0, (p.tracks?.length ?? p.tracksTotal) - 1),
          };
        })
      );
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylistTracks((prev) => prev.filter((_, i) => i !== index));
      }
      if (sessionMode === 'spotify') {
        try {
          await removeTrackFromPlaylist(playlistId, track.uri);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not remove track.');
          return;
        }
      }
      showToast(`Removed "${track.name}"`);
    },
    [selectedPlaylist, sessionMode, showToast]
  );

  const handleReorderPlaylistTrack = useCallback(
    async (playlistId: string, fromIdx: number, toIdx: number) => {
      const reorder = <T,>(arr: T[]): T[] => {
        const copy = [...arr];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        return copy;
      };

      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId && p.tracks ? { ...p, tracks: reorder(p.tracks) } : p
        )
      );
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylistTracks((prev) => reorder(prev));
      }

      if (sessionMode === 'spotify') {
        try {
          const insertBefore = toIdx > fromIdx ? toIdx + 1 : toIdx;
          await reorderPlaylistTrack(playlistId, fromIdx, insertBefore);
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not reorder playlist.');
        }
      }
    },
    [selectedPlaylist, sessionMode, showToast]
  );

  const handleSignOut = () => {
    clearStoredTokens();
    setUser(null);
    setSettingsOpen(false);
    setDrawerOpen(false);
    setSessionMode('landing');
    setPlayback((p) => ({ ...p, isPlaying: false }));
  };

  const enterDemoMode = () => {
    setAuthError(null);
    setPlaylists(INITIAL_DEMO_PLAYLISTS);
    setLikedTracks([DEMO_TRACKS[0], DEMO_TRACKS[1], DEMO_TRACKS[4]]);
    setSavedAlbums(DEMO_ALBUMS);
    setFollowedArtists(DEMO_ARTISTS);
    setPresets(DEFAULT_MODE_PRESETS);
    setQueue([DEMO_TRACKS[1], DEMO_TRACKS[2], DEMO_TRACKS[3]]);
    setSessionMode('demo');
    setPlayback({
      track: DEMO_TRACKS[0],
      isPlaying: true,
      positionMs: 12000,
      durationMs: DEMO_TRACKS[0].durationMs,
      volume: 0.72,
      shuffle: false,
      repeat: 'context',
      activeDeviceId: 'demo-synth',
      activeDeviceName: 'Ambient Synth',
      isRemoteControl: false,
      updatedAt: Date.now(),
    });
  };

  const track = playback.track;
  const stageClass =
    lyricsOpen && lyricsLayout === 'overlay'
      ? 'stage stage--overlay'
      : lyricsOpen
        ? 'stage stage--split'
        : 'stage stage--center';

  return (
    <>
      <VisualizerCanvas
        palette={palette}
        style={visualizer}
        mode={mode}
        quality={quality}
        isPlaying={sessionMode === 'landing' ? true : playback.isPlaying}
        trackId={track?.id ?? null}
      />

      {sessionMode === 'landing' && (
        <LandingScreen
          authError={authError}
          onStartDemo={enterDemoMode}
          onConnectSpotify={beginSpotifyLogin}
        />
      )}

      {sessionMode === 'premium-required' && (
        <PremiumRequiredScreen
          user={user}
          onStartDemo={enterDemoMode}
          onSignOut={handleSignOut}
        />
      )}

      {(sessionMode === 'demo' || sessionMode === 'spotify') && (
        <div className={`app-shell app-shell--${mode}`}>
          <TopBar
            visible={chromeVisible}
            sessionMode={sessionMode}
            mode={mode}
            visualizer={visualizer}
            lyricsOpen={lyricsOpen}
            drawerOpen={drawerOpen}
            drawerTab={drawerTab}
            isFullscreen={isFullscreen}
            focusTimerLabel={formatCountdown(focusSecondsLeft)}
            sleepTimerLabel={formatCountdown(sleepSecondsLeft)}
            onSelectMode={(m) => void handleSelectMode(m)}
            onSelectVisualizer={setVisualizer}
            onToggleLyrics={() => setLyricsOpen((v) => !v)}
            onOpenDrawer={(tab) => {
              if (drawerOpen && drawerTab === tab) {
                setDrawerOpen(false);
              } else {
                setDrawerTab(tab);
                setDrawerOpen(true);
              }
            }}
            onToggleFullscreen={handleToggleFullscreen}
            onOpenSettings={() => setSettingsOpen(true)}
            onReturnToConnect={() => {
              setPlayback((p) => ({ ...p, isPlaying: false }));
              setSessionMode('landing');
            }}
          />

          {remoteBanner && (
            <div className="remote-banner" role="status">
              {remoteBanner}
            </div>
          )}

          <main className={stageClass}>
            {(!lyricsOpen || lyricsLayout === 'split') && track && (
              <section className="artwork-focal" aria-label="Now playing">
                <div
                  className={`artwork-frame ${playback.isPlaying ? '' : 'artwork-frame--paused'}`}
                >
                  <img
                    src={track.album.imageUrl}
                    alt={`${track.album.name} cover artwork`}
                    className="artwork-image"
                  />
                </div>
                <div className="artwork-caption">
                  <h1 className="track-headline">{track.name}</h1>
                  <p className="track-byline">
                    {track.artists.map((artist, idx) => (
                      <span key={`${artist.id}-${idx}`}>
                        <button
                          type="button"
                          className="inline-link"
                          onClick={() => {
                            setSearchQuery(artist.name);
                            setDrawerTab('search');
                            setDrawerOpen(true);
                          }}
                        >
                          {artist.name}
                        </button>
                        {idx < track.artists.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </p>
                  <p className="track-album">{track.album.name}</p>
                </div>
              </section>
            )}

            {lyricsOpen && (
              <LyricsPane
                lyrics={lyrics}
                loading={lyricsLoading}
                positionMs={playback.positionMs}
                offsetMs={lyricsOffsetMs}
                layout={lyricsLayout}
                onChangeOffset={(nextOffset) => {
                  setLyricsOffsetMs(nextOffset);
                  if (track) setTrackLyricsOffsetMs(buildTrackLyricsKey(track), nextOffset);
                }}
                onToggleLayout={() =>
                  setLyricsLayout((prev) => (prev === 'split' ? 'overlay' : 'split'))
                }
                onSeekTo={(timeMs) => void handleSeek(timeMs)}
              />
            )}
          </main>

          <TransportBar
            visible={chromeVisible}
            sessionMode={sessionMode}
            playback={playback}
            isLiked={Boolean(track && likedIds.has(track.id))}
            devices={devices}
            demoSynthMuted={demoSynthMuted}
            onTogglePlay={() => void handleTogglePlay()}
            onPrevious={() => void handlePrevious()}
            onNext={() => void handleNext()}
            onSeek={(ms) => void handleSeek(ms)}
            onChangeVolume={(vol) => void handleChangeVolume(vol)}
            onToggleShuffle={() => void handleToggleShuffle()}
            onCycleRepeat={() => void handleCycleRepeat()}
            onToggleLike={() => {
              if (track) void handleToggleLikeTrack(track);
            }}
            onSelectDevice={async (deviceId) => {
              try {
                await transferPlayback(deviceId, true);
                showToast('Transferred playback');
                const updated = await getDevices();
                setDevices(updated);
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Device transfer failed.');
              }
            }}
            onRefreshDevices={() => {
              if (sessionMode === 'spotify') {
                void getDevices().then(setDevices).catch(() => {});
              }
            }}
            onToggleDemoSynth={() => {
              const nextMuted = !demoSynthMuted;
              setDemoSynthMuted(nextMuted);
              synthRef.current?.setAudioMuted(nextMuted);
            }}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onArtistClick={(artistName) => {
              setSearchQuery(artistName);
              setDrawerTab('search');
              setDrawerOpen(true);
            }}
          />

          <DrawerPanel
            open={drawerOpen}
            tab={drawerTab}
            currentTrack={track}
            queue={queue}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searchLoading={searchLoading}
            playlists={playlists}
            likedTracks={likedTracks}
            likedIds={likedIds}
            savedAlbums={savedAlbums}
            followedArtists={followedArtists}
            selectedPlaylist={selectedPlaylist}
            selectedPlaylistTracks={selectedPlaylistTracks}
            selectedPlaylistLoading={selectedPlaylistLoading}
            selectedAlbum={selectedAlbum}
            selectedAlbumTracks={selectedAlbumTracks}
            currentUserId={sessionMode === 'demo' ? 'demo-user' : user?.id || ''}
            onClose={() => setDrawerOpen(false)}
            onChangeTab={setDrawerTab}
            onSearchQueryChange={setSearchQuery}
            onPlayTrack={(t, list, uri) => void handlePlayTrack(t, list, uri)}
            onAddToQueue={(t) => void handleAddToQueue(t)}
            onToggleLikeTrack={(t) => void handleToggleLikeTrack(t)}
            onSelectPlaylist={(pl) => {
              setSelectedAlbum(null);
              setSelectedPlaylist(pl);
            }}
            onSelectAlbum={(alb) => {
              setSelectedPlaylist(null);
              setSelectedAlbum(alb);
            }}
            onCreatePlaylist={handleCreatePlaylist}
            onUpdatePlaylist={handleUpdatePlaylist}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            onReorderPlaylistTrack={handleReorderPlaylistTrack}
          />

          <SettingsModal
            open={settingsOpen}
            sessionMode={sessionMode}
            user={user}
            visualizer={visualizer}
            quality={quality}
            presets={presets}
            playlists={playlists}
            focusMinutesLeft={focusSecondsLeft !== null ? Math.ceil(focusSecondsLeft / 60) : null}
            sleepMinutesLeft={sleepSecondsLeft !== null ? Math.ceil(sleepSecondsLeft / 60) : null}
            demoSynthMuted={demoSynthMuted}
            onClose={() => setSettingsOpen(false)}
            onChangeVisualizer={setVisualizer}
            onChangeQuality={setQuality}
            onLinkModePlaylist={(m, playlistId) =>
              setPresets((prev) => ({
                ...prev,
                [m]: { ...prev[m], linkedPlaylistId: playlistId },
              }))
            }
            onStartFocusTimer={(min) => {
              setFocusSecondsLeft(min ? min * 60 : null);
              if (min) showToast(`Focus timer started (${min} min)`);
            }}
            onStartSleepTimer={(min) => {
              preSleepVolumeRef.current = null;
              setSleepSecondsLeft(min ? min * 60 : null);
              if (min) showToast(`Sleep timer set for ${min} min`);
            }}
            onToggleDemoSynth={() => {
              const nextMuted = !demoSynthMuted;
              setDemoSynthMuted(nextMuted);
              synthRef.current?.setAudioMuted(nextMuted);
            }}
            onConnectSpotify={() => {
              setSettingsOpen(false);
              setPlayback((p) => ({ ...p, isPlaying: false }));
              setSessionMode('landing');
            }}
            onSignOut={handleSignOut}
          />

          <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

          {toast && (
            <div className="toast-banner" role="status" aria-live="polite">
              {toast}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
