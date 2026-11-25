import { useState } from 'react';
import {
  ExternalLink,
  Heart,
  HelpCircle,
  Laptop,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Speaker,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PlaybackDevice, PlaybackState, RepeatMode, SessionMode } from '../types/music';

interface TransportBarProps {
  visible: boolean;
  sessionMode: SessionMode;
  playback: PlaybackState;
  isLiked: boolean;
  devices: PlaybackDevice[];
  demoSynthMuted: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
  onChangeVolume: (vol01: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: () => void;
  onSelectDevice: (deviceId: string) => void;
  onRefreshDevices: () => void;
  onToggleDemoSynth: () => void;
  onOpenShortcuts: () => void;
  onArtistClick: (artistName: string) => void;
}

export function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function nextRepeatLabel(repeat: RepeatMode): string {
  if (repeat === 'off') return 'Repeat off';
  if (repeat === 'context') return 'Repeat playlist or album';
  return 'Repeat current track';
}

export function TransportBar({
  visible,
  sessionMode,
  playback,
  isLiked,
  devices,
  demoSynthMuted,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onChangeVolume,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onSelectDevice,
  onRefreshDevices,
  onToggleDemoSynth,
  onOpenShortcuts,
  onArtistClick,
}: TransportBarProps) {
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [lastNonZeroVolume, setLastNonZeroVolume] = useState(0.78);

  const track = playback.track;
  const duration = Math.max(1, playback.durationMs || track?.durationMs || 1);
  const displayPos = scrubMs ?? playback.positionMs;
  const progressPct = Math.max(0, Math.min(100, (displayPos / duration) * 100));

  const toggleMute = () => {
    if (playback.volume > 0.01) {
      setLastNonZeroVolume(playback.volume);
      onChangeVolume(0);
    } else {
      onChangeVolume(lastNonZeroVolume || 0.72);
    }
  };

  return (
    <footer className={`transport-bar ${visible ? 'chrome-visible' : 'chrome-hidden'}`}>
      <div className="scrubber-row">
        <span className="timecode tabular">{formatTime(displayPos)}</span>
        <div className="scrubber-track">
          <div className="scrubber-fill" style={{ width: `${progressPct}%` }} />
          <input
            type="range"
            min={0}
            max={duration}
            step={500}
            value={Math.min(displayPos, duration)}
            aria-label="Seek playback position"
            className="scrubber-input"
            onChange={(e) => setScrubMs(Number(e.target.value))}
            onMouseUp={(e) => {
              const targetMs = Number((e.target as HTMLInputElement).value);
              setScrubMs(null);
              onSeek(targetMs);
            }}
            onTouchEnd={(e) => {
              const targetMs = Number((e.target as HTMLInputElement).value);
              setScrubMs(null);
              onSeek(targetMs);
            }}
            onKeyUp={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const targetMs = Number((e.target as HTMLInputElement).value);
                setScrubMs(null);
                onSeek(targetMs);
              }
            }}
          />
        </div>
        <span className="timecode tabular">{formatTime(duration)}</span>
      </div>

      <div className="transport-grid">
        <div className="transport-track">
          {track && (
            <>
              <div className="transport-track__meta">
                <div className="transport-track__title">{track.name}</div>
                <div className="transport-track__artists">
                  {track.artists.map((artist, idx) => (
                    <span key={`${artist.id}-${idx}`}>
                      <button
                        type="button"
                        className="inline-link"
                        onClick={() => onArtistClick(artist.name)}
                      >
                        {artist.name}
                      </button>
                      {idx < track.artists.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className={`icon-btn ${isLiked ? 'is-liked' : ''}`}
                onClick={onToggleLike}
                aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                aria-pressed={isLiked}
                title={isLiked ? 'Saved in Library' : 'Save track'}
              >
                <Heart
                  size={16}
                  strokeWidth={1.75}
                  fill={isLiked ? 'currentColor' : 'none'}
                />
              </button>
            </>
          )}
        </div>

        <div className="transport-controls">
          <button
            type="button"
            className={`icon-btn ${playback.shuffle ? 'is-active' : ''}`}
            onClick={onToggleShuffle}
            aria-label="Toggle shuffle"
            aria-pressed={playback.shuffle}
            title="Shuffle"
          >
            <Shuffle size={16} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onPrevious}
            aria-label="Previous track"
            title="Previous"
          >
            <SkipBack size={18} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="play-btn"
            onClick={onTogglePlay}
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
            title="Play / Pause (Space)"
          >
            {playback.isPlaying ? (
              <Pause size={20} strokeWidth={2} fill="currentColor" />
            ) : (
              <Play size={20} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onNext}
            aria-label="Next track"
            title="Next"
          >
            <SkipForward size={18} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className={`icon-btn ${playback.repeat !== 'off' ? 'is-active' : ''}`}
            onClick={onCycleRepeat}
            aria-label={nextRepeatLabel(playback.repeat)}
            title={nextRepeatLabel(playback.repeat)}
          >
            {playback.repeat === 'track' ? (
              <Repeat1 size={16} strokeWidth={1.75} />
            ) : (
              <Repeat size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>

        <div className="transport-utilities">
          <div className="device-popover-anchor">
            <button
              type="button"
              className={`ghost-pill ${devicesOpen ? 'is-active' : ''}`}
              onClick={() => {
                const next = !devicesOpen;
                setDevicesOpen(next);
                if (next) onRefreshDevices();
              }}
              aria-expanded={devicesOpen}
              title="Playback output device"
            >
              <Speaker size={14} strokeWidth={1.75} />
              <span className="device-pill-label">
                {playback.activeDeviceName || (sessionMode === 'demo' ? 'Ambient Synth' : 'Aura Web')}
              </span>
            </button>

            {devicesOpen && (
              <div className="popover-panel" role="dialog" aria-label="Playback devices">
                <div className="popover-header">
                  <span>Playback output</span>
                  {sessionMode === 'spotify' && (
                    <button type="button" className="text-btn" onClick={onRefreshDevices}>
                      Refresh
                    </button>
                  )}
                </div>

                {sessionMode === 'demo' ? (
                  <div className="device-list">
                    <button
                      type="button"
                      className="device-item is-active"
                      onClick={onToggleDemoSynth}
                    >
                      <Laptop size={15} strokeWidth={1.75} />
                      <div className="device-item__text">
                        <span>Built-in Ambient Synth</span>
                        <small>{demoSynthMuted ? 'Audio muted (visual timeline only)' : 'Playing warm pad chords'}</small>
                      </div>
                    </button>
                  </div>
                ) : devices.length > 0 ? (
                  <div className="device-list">
                    {devices.map((dev) => (
                      <button
                        key={dev.id}
                        type="button"
                        className={`device-item ${dev.isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          onSelectDevice(dev.id);
                          setDevicesOpen(false);
                        }}
                      >
                        {dev.type.toLowerCase().includes('phone') ? (
                          <Smartphone size={15} strokeWidth={1.75} />
                        ) : (
                          <Laptop size={15} strokeWidth={1.75} />
                        )}
                        <div className="device-item__text">
                          <span>{dev.name}</span>
                          <small>{dev.isActive ? 'Active now' : dev.type}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="popover-empty">
                    No active Spotify Connect devices found. Open Spotify on your phone or desktop, or wait for Aura Web Player to initialize.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="volume-control">
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={toggleMute}
              aria-label={playback.volume <= 0.01 ? 'Unmute' : 'Mute'}
            >
              {playback.volume <= 0.01 ? (
                <VolumeX size={16} strokeWidth={1.75} />
              ) : (
                <Volume2 size={16} strokeWidth={1.75} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={playback.volume}
              aria-label="Volume"
              className="volume-slider"
              onChange={(e) => onChangeVolume(Number(e.target.value))}
            />
          </div>

          {track?.externalUrl && (
            <a
              href={track.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="spotify-attribution"
              title="Listen on Spotify"
            >
              <span>Spotify</span>
              <ExternalLink size={12} strokeWidth={1.75} />
            </a>
          )}

          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </footer>
  );
}
