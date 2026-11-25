import { useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Disc3,
  ExternalLink,
  LogOut,
  Play,
  Sliders,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  ModePreset,
  MoodMode,
  Playlist,
  SessionMode,
  UserProfile,
  VisualizerQuality,
  VisualizerStyle,
} from '../types/music';
import { getConfiguredClientId, getRedirectUri } from '../services/spotifyAuth';

interface LandingOverlayProps {
  authError: string | null;
  onStartDemo: () => void;
  onConnectSpotify: (clientId: string) => Promise<void>;
}

export function LandingScreen({
  authError,
  onStartDemo,
  onConnectSpotify,
}: LandingOverlayProps) {
  const [clientId, setClientId] = useState(() => getConfiguredClientId());
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const redirectUri = getRedirectUri();

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleConnect = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLocalError(null);
    if (!clientId.trim()) {
      setShowSetup(true);
      setLocalError('Paste your Spotify Client ID below to sign in.');
      return;
    }
    setBusy(true);
    try {
      await onConnectSpotify(clientId.trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to start Spotify sign-in.');
      setBusy(false);
    }
  };

  return (
    <main className="landing-shell">
      <div className="landing-inner">
        <div className="landing-brand">
          <span className="brand-dot" aria-hidden="true" />
          <span>Aura</span>
        </div>

        <h1 className="landing-title">A quiet room built around what&apos;s playing.</h1>

        <p className="landing-copy">
          Full-screen Spotify listening where the sleeve sets the room&apos;s light, lyrics scroll in time, and search or playlists stay neatly out of sight until you reach for them.
        </p>

        {(authError || localError) && (
          <div className="inline-alert" role="alert">
            {authError || localError}
          </div>
        )}

        <div className="landing-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleConnect()}
            disabled={busy}
          >
            <Disc3 size={17} strokeWidth={1.75} />
            <span>{busy ? 'Opening Spotify…' : 'Sign in with Spotify'}</span>
          </button>

          <button type="button" className="secondary-btn" onClick={onStartDemo}>
            <Play size={16} strokeWidth={1.75} />
            <span>Enter Demo Mode</span>
          </button>
        </div>

        <div className="landing-setup">
          <button
            type="button"
            className="text-btn"
            onClick={() => setShowSetup((v) => !v)}
          >
            {showSetup ? 'Hide Spotify App setup' : 'Configure Spotify Client ID & Redirect URI'}
          </button>

          {showSetup && (
            <form className="setup-box" onSubmit={(e) => void handleConnect(e)}>
              <label className="field-label" htmlFor="spotify-client-id">
                Spotify Client ID
              </label>
              <input
                id="spotify-client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Paste 32-character Client ID from Spotify Developer Dashboard"
                autoComplete="off"
              />

              <div className="redirect-row">
                <div className="redirect-row__meta">
                  <span className="field-label">Redirect URI to register in Dashboard</span>
                  <code className="code-pill">{redirectUri}</code>
                </div>
                <button
                  type="button"
                  className="ghost-pill"
                  onClick={() => void copyRedirect()}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="setup-notes">
                <p>
                  Spotify Web Playback SDK requires a <strong>Spotify Premium</strong> account. In Development Mode, add yourself (and up to 4 Premium testers) under User Management in the{' '}
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-link"
                  >
                    Spotify Developer Dashboard <ExternalLink size={11} style={{ display: 'inline' }} />
                  </a>
                  .
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

interface PremiumRequiredScreenProps {
  user: UserProfile | null;
  onStartDemo: () => void;
  onSignOut: () => void;
}

export function PremiumRequiredScreen({
  user,
  onStartDemo,
  onSignOut,
}: PremiumRequiredScreenProps) {
  return (
    <main className="landing-shell">
      <div className="landing-inner">
        <div className="landing-brand">
          <span className="brand-dot" aria-hidden="true" />
          <span>Aura</span>
        </div>

        <h1 className="landing-title">Spotify Premium is required for browser playback.</h1>

        <p className="landing-copy">
          Signed in as <strong>{user?.displayName || 'Spotify user'}</strong> ({user?.product || 'free'} tier). Spotify&apos;s Web Playback SDK only streams full tracks to Premium accounts. You can still experience the full interface, generative visualizers, and synced lyrics in Demo Mode.
        </p>

        <div className="landing-actions">
          <button type="button" className="primary-btn" onClick={onStartDemo}>
            <Play size={16} strokeWidth={1.75} />
            <span>Open Demo Mode</span>
          </button>
          <button type="button" className="secondary-btn" onClick={onSignOut}>
            <LogOut size={16} strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </main>
  );
}

interface SettingsModalProps {
  open: boolean;
  sessionMode: SessionMode;
  user: UserProfile | null;
  visualizer: VisualizerStyle;
  quality: VisualizerQuality;
  presets: Record<MoodMode, ModePreset>;
  playlists: Playlist[];
  focusMinutesLeft: number | null;
  sleepMinutesLeft: number | null;
  demoSynthMuted: boolean;
  onClose: () => void;
  onChangeVisualizer: (style: VisualizerStyle) => void;
  onChangeQuality: (q: VisualizerQuality) => void;
  onLinkModePlaylist: (mode: MoodMode, playlistId: string | null) => void;
  onStartFocusTimer: (minutes: number | null) => void;
  onStartSleepTimer: (minutes: number | null) => void;
  onToggleDemoSynth: () => void;
  onConnectSpotify: () => void;
  onSignOut: () => void;
}

export function SettingsModal({
  open,
  sessionMode,
  user,
  visualizer,
  quality,
  presets,
  playlists,
  focusMinutesLeft,
  sleepMinutesLeft,
  demoSynthMuted,
  onClose,
  onChangeVisualizer,
  onChangeQuality,
  onLinkModePlaylist,
  onStartFocusTimer,
  onStartSleepTimer,
  onToggleDemoSynth,
  onConnectSpotify,
  onSignOut,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-label="Aura Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Sliders size={16} strokeWidth={1.75} />
            <h2>Settings</h2>
          </div>
          <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close settings">
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal-body">
          <section className="settings-group">
            <h3>Visualizer style</h3>
            <p className="settings-desc">
              Choose the generative backdrop painted from the current album cover.
            </p>
            <div className="pill-row">
              {(['flow', 'orbit', 'pulse'] as VisualizerStyle[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`filter-pill ${visualizer === opt ? 'is-active' : ''}`}
                  onClick={() => onChangeVisualizer(opt)}
                >
                  {opt[0].toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-group">
            <h3>Visualizer quality</h3>
            <p className="settings-desc">
              Canvas rendering automatically pauses whenever this tab is hidden.
            </p>
            <div className="pill-row">
              {(['auto', 'high', 'low'] as VisualizerQuality[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`filter-pill ${quality === opt ? 'is-active' : ''}`}
                  onClick={() => onChangeQuality(opt)}
                >
                  {opt[0].toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-group">
            <h3>
              <Timer size={14} strokeWidth={1.75} style={{ display: 'inline', marginRight: 6 }} />
              Focus Pomodoro timer
            </h3>
            <p className="settings-desc">
              Runs quietly in the corner during Focus sessions.
            </p>
            <div className="pill-row">
              {[25, 45, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  className="filter-pill"
                  onClick={() => onStartFocusTimer(min)}
                >
                  {min} min
                </button>
              ))}
              {focusMinutesLeft !== null && (
                <button
                  type="button"
                  className="filter-pill is-active"
                  onClick={() => onStartFocusTimer(null)}
                >
                  Clear timer
                </button>
              )}
            </div>
          </section>

          <section className="settings-group">
            <h3>
              <Clock size={14} strokeWidth={1.75} style={{ display: 'inline', marginRight: 6 }} />
              Night sleep timer
            </h3>
            <p className="settings-desc">
              Gently fades volume down over the final 20 seconds, then pauses playback.
            </p>
            <div className="pill-row">
              {[15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  className="filter-pill"
                  onClick={() => onStartSleepTimer(min)}
                >
                  {min} min
                </button>
              ))}
              {sleepMinutesLeft !== null && (
                <button
                  type="button"
                  className="filter-pill is-active"
                  onClick={() => onStartSleepTimer(null)}
                >
                  Cancel sleep
                </button>
              )}
            </div>
          </section>

          <section className="settings-group">
            <h3>Mode playlist bindings</h3>
            <p className="settings-desc">
              Optionally start a chosen playlist when switching into a mood mode.
            </p>
            <div className="bindings-list">
              {(['focus', 'chill', 'night'] as MoodMode[]).map((m) => (
                <label key={m} className="binding-row">
                  <span>{presets[m].label}</span>
                  <select
                    value={presets[m].linkedPlaylistId || ''}
                    onChange={(e) => onLinkModePlaylist(m, e.target.value || null)}
                  >
                    <option value="">Keep current playback</option>
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          {sessionMode === 'demo' && (
            <section className="settings-group">
              <h3>Demo audio synthesis</h3>
              <button type="button" className="ghost-pill" onClick={onToggleDemoSynth}>
                {demoSynthMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>
                  {demoSynthMuted
                    ? 'Ambient pad muted — click to enable sound'
                    : 'Ambient pad active — click to mute'}
                </span>
              </button>
            </section>
          )}

          <section className="settings-group settings-group--footer">
            {sessionMode === 'spotify' ? (
              <div className="account-bar">
                <div>
                  <strong>{user?.displayName || 'Spotify Premium'}</strong>
                  <small>{user?.email || 'Connected via PKCE'}</small>
                </div>
                <button type="button" className="ghost-pill" onClick={onSignOut}>
                  <LogOut size={14} strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="account-bar">
                <div>
                  <strong>Demo Mode</strong>
                  <small>Simulated catalog &amp; built-in synced LRC</small>
                </div>
                <button type="button" className="primary-btn primary-btn--sm" onClick={onConnectSpotify}>
                  Connect Spotify
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play or pause'],
  ['← / →', 'Seek backward or forward 10 seconds'],
  ['↑ / ↓', 'Raise or lower volume'],
  ['L', 'Show or hide synced lyrics'],
  ['Shift + L', 'Switch between split and full-canvas lyrics'],
  ['M', 'Cycle mood mode (Focus → Chill → Night)'],
  ['F', 'Toggle fullscreen ambient mode'],
  ['/', 'Focus search'],
  ['?', 'Open or close this shortcut guide'],
  ['Esc', 'Close active drawer, modal, or fullscreen'],
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel modal-panel--compact"
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <h2>Keyboard shortcuts</h2>
          </div>
          <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close">
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="shortcut-row">
              <span>{desc}</span>
              <kbd>{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
