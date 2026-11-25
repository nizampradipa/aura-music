import {
  AlignLeft,
  Clock,
  Disc3,
  ListMusic,
  Maximize,
  Minimize,
  Moon,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  Timer,
  Waves,
} from 'lucide-react';
import type { DrawerTab, MoodMode, SessionMode, VisualizerStyle } from '../types/music';

interface TopBarProps {
  visible: boolean;
  sessionMode: SessionMode;
  mode: MoodMode;
  visualizer: VisualizerStyle;
  lyricsOpen: boolean;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  isFullscreen: boolean;
  focusTimerLabel: string | null;
  sleepTimerLabel: string | null;
  onSelectMode: (mode: MoodMode) => void;
  onSelectVisualizer: (style: VisualizerStyle) => void;
  onToggleLyrics: () => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onReturnToConnect: () => void;
}

const VISUALIZERS: Array<{ id: VisualizerStyle; label: string }> = [
  { id: 'flow', label: 'Flow' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'pulse', label: 'Pulse' },
];

export function TopBar({
  visible,
  sessionMode,
  mode,
  visualizer,
  lyricsOpen,
  drawerOpen,
  drawerTab,
  isFullscreen,
  focusTimerLabel,
  sleepTimerLabel,
  onSelectMode,
  onSelectVisualizer,
  onToggleLyrics,
  onOpenDrawer,
  onToggleFullscreen,
  onOpenSettings,
  onReturnToConnect,
}: TopBarProps) {
  return (
    <header className={`top-bar ${visible ? 'chrome-visible' : 'chrome-hidden'}`}>
      <div className="top-bar__left">
        <div className="brand-mark">
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-name">Aura</span>
        </div>

        {sessionMode === 'demo' && (
          <button
            type="button"
            className="session-badge"
            onClick={onReturnToConnect}
            title="Switch to live Spotify account"
          >
            Demo · Connect Spotify
          </button>
        )}

        {focusTimerLabel && (
          <button
            type="button"
            className="timer-chip"
            onClick={onOpenSettings}
            title="Focus Pomodoro timer"
          >
            <Timer size={13} strokeWidth={1.75} />
            <span className="tabular">{focusTimerLabel}</span>
          </button>
        )}

        {sleepTimerLabel && (
          <button
            type="button"
            className="timer-chip"
            onClick={onOpenSettings}
            title="Night sleep timer"
          >
            <Clock size={13} strokeWidth={1.75} />
            <span className="tabular">Sleep {sleepTimerLabel}</span>
          </button>
        )}
      </div>

      <nav className="mode-switcher" aria-label="Mood modes">
        <button
          type="button"
          className={`seg-btn ${mode === 'focus' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('focus')}
          aria-pressed={mode === 'focus'}
        >
          <Sparkles size={13} strokeWidth={1.75} />
          <span>Focus</span>
        </button>
        <button
          type="button"
          className={`seg-btn ${mode === 'chill' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('chill')}
          aria-pressed={mode === 'chill'}
        >
          <SunMedium size={13} strokeWidth={1.75} />
          <span>Chill</span>
        </button>
        <button
          type="button"
          className={`seg-btn ${mode === 'night' ? 'is-active' : ''}`}
          onClick={() => onSelectMode('night')}
          aria-pressed={mode === 'night'}
        >
          <Moon size={13} strokeWidth={1.75} />
          <span>Night</span>
        </button>
      </nav>

      <div className="top-bar__right">
        <div className="viz-picker" role="group" aria-label="Visualizer style">
          {VISUALIZERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`viz-btn ${visualizer === item.id ? 'is-active' : ''}`}
              onClick={() => onSelectVisualizer(item.id)}
              aria-pressed={visualizer === item.id}
              title={`${item.label} visualizer`}
            >
              {item.id === 'flow' ? (
                <Waves size={13} strokeWidth={1.75} />
              ) : item.id === 'orbit' ? (
                <Disc3 size={13} strokeWidth={1.75} />
              ) : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`icon-btn ${lyricsOpen ? 'is-active' : ''}`}
          onClick={onToggleLyrics}
          aria-pressed={lyricsOpen}
          aria-label="Toggle synced lyrics"
          title="Lyrics (L)"
        >
          <AlignLeft size={17} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className={`icon-btn ${drawerOpen && drawerTab === 'search' ? 'is-active' : ''}`}
          onClick={() => onOpenDrawer('search')}
          aria-label="Search Spotify"
          title="Search (/)"
        >
          <Search size={17} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className={`icon-btn ${drawerOpen && drawerTab !== 'search' ? 'is-active' : ''}`}
          onClick={() => onOpenDrawer('library')}
          aria-label="Open Library and Queue"
          title="Library & Queue"
        >
          <ListMusic size={17} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter ambient fullscreen'}
          title="Fullscreen ambient mode (F)"
        >
          {isFullscreen ? (
            <Minimize size={17} strokeWidth={1.75} />
          ) : (
            <Maximize size={17} strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <Settings size={17} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
