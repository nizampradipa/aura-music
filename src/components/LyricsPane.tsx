import { useEffect, useMemo, useRef } from 'react';
import { Columns2, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { LyricsData, LyricsLayout } from '../types/music';
import { findActiveLyricIndex } from '../services/lyrics';

interface LyricsPaneProps {
  lyrics: LyricsData | null;
  loading: boolean;
  positionMs: number;
  offsetMs: number;
  layout: LyricsLayout;
  onChangeOffset: (nextOffsetMs: number) => void;
  onToggleLayout: () => void;
  onSeekTo: (timeMs: number) => void;
}

export function LyricsPane({
  lyrics,
  loading,
  positionMs,
  offsetMs,
  layout,
  onChangeOffset,
  onToggleLayout,
  onSeekTo,
}: LyricsPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastScrolledIndex = useRef<number>(-1);

  const syncedLines = lyrics?.synced ?? [];
  const activeIndex = useMemo(
    () => findActiveLyricIndex(syncedLines, positionMs + offsetMs),
    [syncedLines, positionMs, offsetMs]
  );

  useEffect(() => {
    lastScrolledIndex.current = -1;
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [lyrics?.trackKey, layout]);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex === lastScrolledIndex.current) return;
    lastScrolledIndex.current = activeIndex;
    const node = lineRefs.current[activeIndex];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  const offsetSeconds = (offsetMs / 1000).toFixed(1);

  return (
    <section
      className={`lyrics-pane lyrics-pane--${layout}`}
      aria-label="Synced lyrics"
    >
      <div className="lyrics-toolbar">
        <div className="lyrics-meta">
          <span className="lyrics-source">
            {loading
              ? 'Finding lyrics…'
              : lyrics?.source === 'demo'
                ? 'Synced lyrics · Demo'
                : lyrics?.source === 'lrclib'
                  ? syncedLines.length > 0
                    ? 'Synced lyrics · LRCLIB'
                    : 'Plain lyrics · LRCLIB'
                  : 'Lyrics'}
          </span>
        </div>

        <div className="lyrics-controls">
          {syncedLines.length > 0 && (
            <div className="offset-control" role="group" aria-label="Lyric timing offset">
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => onChangeOffset(offsetMs - 500)}
                title="Delay lyrics by 0.5s"
                aria-label="Shift lyrics earlier by 0.5 seconds"
              >
                <Minus size={13} strokeWidth={1.75} />
              </button>
              <span className="offset-value" title="Timing offset">
                {offsetMs > 0 ? `+${offsetSeconds}s` : `${offsetSeconds}s`}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => onChangeOffset(offsetMs + 500)}
                title="Advance lyrics by 0.5s"
                aria-label="Shift lyrics later by 0.5 seconds"
              >
                <Plus size={13} strokeWidth={1.75} />
              </button>
              {offsetMs !== 0 && (
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  onClick={() => onChangeOffset(0)}
                  title="Reset timing offset"
                  aria-label="Reset lyric timing offset"
                >
                  <RotateCcw size={12} strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="ghost-pill"
            onClick={onToggleLayout}
            title="Switch between split and full-canvas lyrics (Shift+L)"
          >
            {layout === 'split' ? (
              <>
                <Maximize2 size={13} strokeWidth={1.75} />
                <span>Full canvas</span>
              </>
            ) : (
              <>
                <Columns2 size={13} strokeWidth={1.75} />
                <span>Split view</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="lyrics-scroll" ref={containerRef}>
        {loading ? (
          <div className="lyrics-empty">
            <p>Searching LRCLIB for timed lines…</p>
          </div>
        ) : lyrics?.instrumental ? (
          <div className="lyrics-empty">
            <p className="lyrics-empty-title">Instrumental recording</p>
            <p className="lyrics-empty-sub">Let the room hold the stillness.</p>
          </div>
        ) : syncedLines.length > 0 ? (
          <div className="lyrics-lines">
            {syncedLines.map((line, idx) => {
              const isBlank = line.text.length === 0;
              if (isBlank) {
                return <div key={`${line.timeMs}-${idx}`} className="lyric-pause" aria-hidden="true" />;
              }
              const state =
                idx === activeIndex ? 'active' : idx < activeIndex ? 'past' : 'upcoming';
              return (
                <button
                  key={`${line.timeMs}-${idx}`}
                  ref={(el) => {
                    lineRefs.current[idx] = el;
                  }}
                  type="button"
                  className={`lyric-line lyric-line--${state}`}
                  onClick={() => onSeekTo(Math.max(0, line.timeMs - offsetMs))}
                  aria-current={idx === activeIndex ? 'true' : undefined}
                >
                  {line.text}
                </button>
              );
            })}
          </div>
        ) : lyrics?.plain ? (
          <div className="lyrics-plain">
            {lyrics.plain.split(/\r?\n/).map((line, idx) => (
              <p key={idx}>{line || '\u00A0'}</p>
            ))}
          </div>
        ) : (
          <div className="lyrics-empty">
            <p className="lyrics-empty-title">No lyrics available for this track</p>
            <p className="lyrics-empty-sub">
              LRCLIB does not have a matching entry yet. Switch to Focus mode or fullscreen to keep the canvas open.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
