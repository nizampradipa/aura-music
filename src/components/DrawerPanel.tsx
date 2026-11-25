import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Edit3,
  GripVertical,
  Heart,
  Library,
  ListMusic,
  ListPlus,
  Play,
  Plus,
  Search as SearchIcon,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AlbumSummary,
  ArtistSummary,
  DrawerTab,
  Playlist,
  SearchResults,
  Track,
} from '../types/music';
import { formatTime } from './TransportBar';

interface DrawerPanelProps {
  open: boolean;
  tab: DrawerTab;
  currentTrack: Track | null;
  queue: Track[];
  searchQuery: string;
  searchResults: SearchResults;
  searchLoading: boolean;
  playlists: Playlist[];
  likedTracks: Track[];
  likedIds: Set<string>;
  savedAlbums: AlbumSummary[];
  followedArtists: ArtistSummary[];
  selectedPlaylist: Playlist | null;
  selectedPlaylistTracks: Track[];
  selectedPlaylistLoading: boolean;
  selectedAlbum: AlbumSummary | null;
  selectedAlbumTracks: Track[];
  currentUserId: string;
  onClose: () => void;
  onChangeTab: (tab: DrawerTab) => void;
  onSearchQueryChange: (q: string) => void;
  onPlayTrack: (track: Track, contextTracks?: Track[], contextUri?: string) => void;
  onAddToQueue: (track: Track) => void;
  onToggleLikeTrack: (track: Track) => void;
  onSelectPlaylist: (playlist: Playlist | null) => void;
  onSelectAlbum: (album: AlbumSummary | null) => void;
  onCreatePlaylist: (name: string, description: string) => Promise<void>;
  onUpdatePlaylist: (playlistId: string, name: string, description: string) => Promise<void>;
  onAddTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  onRemoveTrackFromPlaylist: (playlistId: string, track: Track, index: number) => Promise<void>;
  onReorderPlaylistTrack: (playlistId: string, fromIdx: number, toIdx: number) => Promise<void>;
}

type SearchFilter = 'tracks' | 'artists' | 'albums' | 'playlists';
type LibrarySection = 'playlists' | 'liked' | 'albums' | 'artists';

export function DrawerPanel({
  open,
  tab,
  currentTrack,
  queue,
  searchQuery,
  searchResults,
  searchLoading,
  playlists,
  likedTracks,
  likedIds,
  savedAlbums,
  followedArtists,
  selectedPlaylist,
  selectedPlaylistTracks,
  selectedPlaylistLoading,
  selectedAlbum,
  selectedAlbumTracks,
  currentUserId,
  onClose,
  onChangeTab,
  onSearchQueryChange,
  onPlayTrack,
  onAddToQueue,
  onToggleLikeTrack,
  onSelectPlaylist,
  onSelectAlbum,
  onCreatePlaylist,
  onUpdatePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onReorderPlaylistTrack,
}: DrawerPanelProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('tracks');
  const [librarySection, setLibrarySection] = useState<LibrarySection>('playlists');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  // Create playlist inline form
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');

  // Edit playlist inline form
  const [editingPlaylist, setEditingPlaylist] = useState(false);
  const [editPlName, setEditPlName] = useState('');
  const [editPlDesc, setEditPlDesc] = useState('');

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open && tab === 'search') {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open, tab]);

  useEffect(() => {
    setHighlightedIdx(-1);
  }, [searchQuery, searchFilter]);

  useEffect(() => {
    setEditingPlaylist(false);
    if (selectedPlaylist) {
      setEditPlName(selectedPlaylist.name);
      setEditPlDesc(selectedPlaylist.description);
    }
  }, [selectedPlaylist]);

  const editablePlaylists = useMemo(
    () => playlists.filter((p) => p.ownerId === currentUserId || p.collaborative),
    [playlists, currentUserId]
  );

  const canEditSelected =
    Boolean(selectedPlaylist) &&
    (selectedPlaylist!.ownerId === currentUserId || selectedPlaylist!.collaborative);

  const totalPlaylistDuration = useMemo(
    () => selectedPlaylistTracks.reduce((sum, t) => sum + t.durationMs, 0),
    [selectedPlaylistTracks]
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchFilter !== 'tracks' || searchResults.tracks.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => Math.min(prev + 1, searchResults.tracks.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      const chosen = searchResults.tracks[highlightedIdx];
      if (chosen) onPlayTrack(chosen, searchResults.tracks);
    }
  };

  const submitNewPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim()) return;
    await onCreatePlaylist(newPlName.trim(), newPlDesc.trim());
    setNewPlName('');
    setNewPlDesc('');
    setCreatingPlaylist(false);
  };

  const submitEditPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist || !editPlName.trim()) return;
    await onUpdatePlaylist(selectedPlaylist.id, editPlName.trim(), editPlDesc.trim());
    setEditingPlaylist(false);
  };

  const renderTrackRow = (
    track: Track,
    index: number,
    list: Track[],
    options: {
      contextUri?: string;
      highlighted?: boolean;
      editablePlaylistId?: string;
    } = {}
  ) => {
    const isCurrent = currentTrack?.id === track.id;
    const isLiked = likedIds.has(track.id);
    const draggable = Boolean(options.editablePlaylistId);

    return (
      <div
        key={`${track.id}-${index}`}
        className={`track-row ${isCurrent ? 'is-current' : ''} ${
          options.highlighted ? 'is-highlighted' : ''
        } ${dragOverIndex === index ? 'is-drag-over' : ''}`}
        draggable={draggable}
        onDragStart={() => {
          if (draggable) setDragIndex(index);
        }}
        onDragOver={(e) => {
          if (!draggable) return;
          e.preventDefault();
          if (dragOverIndex !== index) setDragOverIndex(index);
        }}
        onDragLeave={() => {
          if (dragOverIndex === index) setDragOverIndex(null);
        }}
        onDrop={(e) => {
          if (!draggable || !options.editablePlaylistId) return;
          e.preventDefault();
          if (dragIndex !== null && dragIndex !== index) {
            void onReorderPlaylistTrack(options.editablePlaylistId, dragIndex, index);
          }
          setDragIndex(null);
          setDragOverIndex(null);
        }}
        onDragEnd={() => {
          setDragIndex(null);
          setDragOverIndex(null);
        }}
      >
        {draggable && (
          <span className="drag-handle" aria-hidden="true" title="Drag to reorder">
            <GripVertical size={14} strokeWidth={1.75} />
          </span>
        )}

        <button
          type="button"
          className="track-row__main"
          onClick={() => onPlayTrack(track, list, options.contextUri)}
        >
          {track.album.imageUrl ? (
            <img
              src={track.album.imageUrl}
              alt=""
              className="track-thumb"
              loading="lazy"
            />
          ) : (
            <div className="track-thumb track-thumb--blank" />
          )}
          <div className="track-row__text">
            <span className="track-row__title">{track.name}</span>
            <span className="track-row__sub">
              {track.artists.map((a) => a.name).join(', ')}
            </span>
          </div>
        </button>

        <span className="track-row__dur tabular">{formatTime(track.durationMs)}</span>

        <div className="track-row__actions">
          <button
            type="button"
            className={`icon-btn icon-btn--xs ${isLiked ? 'is-liked' : ''}`}
            onClick={() => onToggleLikeTrack(track)}
            aria-label={isLiked ? 'Unsave track' : 'Save track'}
            title={isLiked ? 'Saved' : 'Save track'}
          >
            <Heart size={13} strokeWidth={1.75} fill={isLiked ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            className="icon-btn icon-btn--xs"
            onClick={() => onAddToQueue(track)}
            aria-label="Add to queue"
            title="Add to queue"
          >
            <ListPlus size={14} strokeWidth={1.75} />
          </button>

          {!options.editablePlaylistId && editablePlaylists.length > 0 && (
            <button
              type="button"
              className="icon-btn icon-btn--xs"
              onClick={() => setAddingTrack(track)}
              aria-label="Add to playlist"
              title="Add to playlist"
            >
              <Plus size={14} strokeWidth={1.75} />
            </button>
          )}

          {options.editablePlaylistId && (
            <>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                disabled={index === 0}
                onClick={() =>
                  void onReorderPlaylistTrack(options.editablePlaylistId!, index, index - 1)
                }
                aria-label="Move track up"
                title="Move up"
              >
                <ArrowUp size={13} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                disabled={index === list.length - 1}
                onClick={() =>
                  void onReorderPlaylistTrack(options.editablePlaylistId!, index, index + 1)
                }
                aria-label="Move track down"
                title="Move down"
              >
                <ArrowDown size={13} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() =>
                  void onRemoveTrackFromPlaylist(options.editablePlaylistId!, track, index)
                }
                aria-label="Remove track from playlist"
                title="Remove from playlist"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-label="Browse, Search, and Queue"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="drawer-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'search'}
              className={`drawer-tab ${tab === 'search' ? 'is-active' : ''}`}
              onClick={() => onChangeTab('search')}
            >
              <SearchIcon size={15} strokeWidth={1.75} />
              <span>Search</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'library'}
              className={`drawer-tab ${tab === 'library' ? 'is-active' : ''}`}
              onClick={() => onChangeTab('library')}
            >
              <Library size={15} strokeWidth={1.75} />
              <span>Library</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'queue'}
              className={`drawer-tab ${tab === 'queue' ? 'is-active' : ''}`}
              onClick={() => onChangeTab('queue')}
            >
              <ListMusic size={15} strokeWidth={1.75} />
              <span>Queue</span>
            </button>
          </div>

          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        <div className="drawer-body">
          {tab === 'search' && (
            <div className="drawer-section">
              <div className="search-field">
                <SearchIcon size={16} strokeWidth={1.75} className="search-field__icon" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Tracks, artists, albums, or playlists…"
                  aria-label="Search music catalog"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    onClick={() => onSearchQueryChange('')}
                    aria-label="Clear search"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>

              <div className="pill-row">
                {(['tracks', 'artists', 'albums', 'playlists'] as SearchFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`filter-pill ${searchFilter === key ? 'is-active' : ''}`}
                    onClick={() => setSearchFilter(key)}
                  >
                    {key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>

              {searchLoading ? (
                <p className="drawer-empty">Searching catalog…</p>
              ) : !searchQuery.trim() ? (
                <p className="drawer-empty">
                  Type to search. Use arrow keys and Enter to start a track without leaving the keyboard.
                </p>
              ) : searchFilter === 'tracks' ? (
                searchResults.tracks.length > 0 ? (
                  <div className="track-list">
                    {searchResults.tracks.map((t, i) =>
                      renderTrackRow(t, i, searchResults.tracks, {
                        highlighted: i === highlightedIdx,
                      })
                    )}
                  </div>
                ) : (
                  <p className="drawer-empty">No matching tracks found.</p>
                )
              ) : searchFilter === 'artists' ? (
                searchResults.artists.length > 0 ? (
                  <div className="entity-list">
                    {searchResults.artists.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        className="entity-row"
                        onClick={() => onSearchQueryChange(artist.name)}
                      >
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt="" className="entity-avatar" />
                        ) : (
                          <div className="entity-avatar entity-avatar--blank" />
                        )}
                        <div className="entity-row__text">
                          <span>{artist.name}</span>
                          <small>{artist.genres?.slice(0, 2).join(' · ') || 'Artist'}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="drawer-empty">No matching artists found.</p>
                )
              ) : searchFilter === 'albums' ? (
                searchResults.albums.length > 0 ? (
                  <div className="entity-list">
                    {searchResults.albums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        className="entity-row"
                        onClick={() => {
                          onSelectAlbum(album);
                          onChangeTab('library');
                        }}
                      >
                        <img src={album.imageUrl} alt="" className="track-thumb" />
                        <div className="entity-row__text">
                          <span>{album.name}</span>
                          <small>
                            {album.artists.map((a) => a.name).join(', ')}
                            {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ''}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="drawer-empty">No matching albums found.</p>
                )
              ) : searchResults.playlists.length > 0 ? (
                <div className="entity-list">
                  {searchResults.playlists.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className="entity-row"
                      onClick={() => {
                        onSelectPlaylist(pl);
                        onChangeTab('library');
                      }}
                    >
                      {pl.imageUrl ? (
                        <img src={pl.imageUrl} alt="" className="track-thumb" />
                      ) : (
                        <div className="track-thumb track-thumb--blank" />
                      )}
                      <div className="entity-row__text">
                        <span>{pl.name}</span>
                        <small>
                          {pl.ownerName} · {pl.tracksTotal} tracks
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="drawer-empty">No matching playlists found.</p>
              )}
            </div>
          )}

          {tab === 'library' && (
            <div className="drawer-section">
              {selectedPlaylist ? (
                <div className="detail-view">
                  <div className="detail-nav">
                    <button
                      type="button"
                      className="ghost-pill"
                      onClick={() => onSelectPlaylist(null)}
                    >
                      <ArrowLeft size={14} strokeWidth={1.75} />
                      <span>All playlists</span>
                    </button>

                    {canEditSelected && !editingPlaylist && (
                      <button
                        type="button"
                        className="ghost-pill"
                        onClick={() => setEditingPlaylist(true)}
                      >
                        <Edit3 size={13} strokeWidth={1.75} />
                        <span>Edit details</span>
                      </button>
                    )}
                  </div>

                  {editingPlaylist ? (
                    <form className="inline-form" onSubmit={submitEditPlaylist}>
                      <input
                        type="text"
                        value={editPlName}
                        onChange={(e) => setEditPlName(e.target.value)}
                        placeholder="Playlist name"
                        required
                      />
                      <textarea
                        rows={2}
                        value={editPlDesc}
                        onChange={(e) => setEditPlDesc(e.target.value)}
                        placeholder="Description"
                      />
                      <div className="inline-form__actions">
                        <button type="submit" className="primary-btn primary-btn--sm">
                          <Check size={14} strokeWidth={1.75} />
                          <span>Save changes</span>
                        </button>
                        <button
                          type="button"
                          className="ghost-pill"
                          onClick={() => setEditingPlaylist(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="detail-head">
                      {selectedPlaylist.imageUrl ? (
                        <img
                          src={selectedPlaylist.imageUrl}
                          alt={selectedPlaylist.name}
                          className="detail-cover"
                        />
                      ) : (
                        <div className="detail-cover track-thumb--blank" />
                      )}
                      <div className="detail-head__meta">
                        <h3>{selectedPlaylist.name}</h3>
                        {selectedPlaylist.description && (
                          <p className="detail-desc">{selectedPlaylist.description}</p>
                        )}
                        <div className="detail-stats tabular">
                          <span>{selectedPlaylistTracks.length} tracks</span>
                          <span>·</span>
                          <span>{formatTime(totalPlaylistDuration)}</span>
                        </div>
                        {selectedPlaylistTracks.length > 0 && (
                          <button
                            type="button"
                            className="primary-btn primary-btn--sm"
                            onClick={() =>
                              onPlayTrack(
                                selectedPlaylistTracks[0],
                                selectedPlaylistTracks,
                                selectedPlaylist.uri
                              )
                            }
                          >
                            <Play size={13} strokeWidth={2} fill="currentColor" />
                            <span>Play playlist</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {canEditSelected && selectedPlaylistTracks.length > 1 && (
                    <p className="hint-line">Drag tracks or use the arrows to reorder.</p>
                  )}

                  {selectedPlaylistLoading ? (
                    <p className="drawer-empty">Loading tracks…</p>
                  ) : selectedPlaylistTracks.length > 0 ? (
                    <div className="track-list">
                      {selectedPlaylistTracks.map((t, i) =>
                        renderTrackRow(t, i, selectedPlaylistTracks, {
                          contextUri: selectedPlaylist.uri,
                          editablePlaylistId: canEditSelected ? selectedPlaylist.id : undefined,
                        })
                      )}
                    </div>
                  ) : (
                    <p className="drawer-empty">
                      This playlist is empty. Search for tracks and click + to add them here.
                    </p>
                  )}
                </div>
              ) : selectedAlbum ? (
                <div className="detail-view">
                  <div className="detail-nav">
                    <button
                      type="button"
                      className="ghost-pill"
                      onClick={() => onSelectAlbum(null)}
                    >
                      <ArrowLeft size={14} strokeWidth={1.75} />
                      <span>Back to library</span>
                    </button>
                  </div>
                  <div className="detail-head">
                    <img
                      src={selectedAlbum.imageUrl}
                      alt={selectedAlbum.name}
                      className="detail-cover"
                    />
                    <div className="detail-head__meta">
                      <h3>{selectedAlbum.name}</h3>
                      <p className="detail-desc">
                        {selectedAlbum.artists.map((a) => a.name).join(', ')}
                        {selectedAlbum.releaseDate ? ` · ${selectedAlbum.releaseDate.slice(0, 4)}` : ''}
                      </p>
                      {selectedAlbumTracks.length > 0 && (
                        <button
                          type="button"
                          className="primary-btn primary-btn--sm"
                          onClick={() =>
                            onPlayTrack(
                              selectedAlbumTracks[0],
                              selectedAlbumTracks,
                              selectedAlbum.uri
                            )
                          }
                        >
                          <Play size={13} strokeWidth={2} fill="currentColor" />
                          <span>Play album</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="track-list">
                    {selectedAlbumTracks.map((t, i) =>
                      renderTrackRow(t, i, selectedAlbumTracks, {
                        contextUri: selectedAlbum.uri,
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="pill-row pill-row--spread">
                    <div className="pill-row">
                      {(
                        [
                          ['playlists', 'Playlists'],
                          ['liked', 'Liked'],
                          ['albums', 'Albums'],
                          ['artists', 'Artists'],
                        ] as Array<[LibrarySection, string]>
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`filter-pill ${librarySection === id ? 'is-active' : ''}`}
                          onClick={() => setLibrarySection(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {librarySection === 'playlists' && (
                      <button
                        type="button"
                        className="ghost-pill"
                        onClick={() => setCreatingPlaylist((v) => !v)}
                      >
                        <Plus size={13} strokeWidth={1.75} />
                        <span>New</span>
                      </button>
                    )}
                  </div>

                  {creatingPlaylist && librarySection === 'playlists' && (
                    <form className="inline-form" onSubmit={submitNewPlaylist}>
                      <input
                        type="text"
                        value={newPlName}
                        onChange={(e) => setNewPlName(e.target.value)}
                        placeholder="New playlist name"
                        autoFocus
                        required
                      />
                      <input
                        type="text"
                        value={newPlDesc}
                        onChange={(e) => setNewPlDesc(e.target.value)}
                        placeholder="Optional description"
                      />
                      <div className="inline-form__actions">
                        <button type="submit" className="primary-btn primary-btn--sm">
                          Create playlist
                        </button>
                        <button
                          type="button"
                          className="ghost-pill"
                          onClick={() => setCreatingPlaylist(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {librarySection === 'playlists' && (
                    <div className="entity-list">
                      {playlists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          className="entity-row"
                          onClick={() => onSelectPlaylist(pl)}
                        >
                          {pl.imageUrl ? (
                            <img src={pl.imageUrl} alt="" className="track-thumb" />
                          ) : (
                            <div className="track-thumb track-thumb--blank" />
                          )}
                          <div className="entity-row__text">
                            <span>{pl.name}</span>
                            <small>
                              {pl.ownerName} · {pl.tracks?.length ?? pl.tracksTotal} tracks
                            </small>
                          </div>
                        </button>
                      ))}
                      {playlists.length === 0 && (
                        <p className="drawer-empty">No playlists in your library yet.</p>
                      )}
                    </div>
                  )}

                  {librarySection === 'liked' && (
                    <div className="track-list">
                      {likedTracks.length > 0 ? (
                        likedTracks.map((t, i) => renderTrackRow(t, i, likedTracks))
                      ) : (
                        <p className="drawer-empty">
                          Saved songs will appear here. Click the heart on any track to save it.
                        </p>
                      )}
                    </div>
                  )}

                  {librarySection === 'albums' && (
                    <div className="entity-list">
                      {savedAlbums.map((album) => (
                        <button
                          key={album.id}
                          type="button"
                          className="entity-row"
                          onClick={() => onSelectAlbum(album)}
                        >
                          <img src={album.imageUrl} alt="" className="track-thumb" />
                          <div className="entity-row__text">
                            <span>{album.name}</span>
                            <small>{album.artists.map((a) => a.name).join(', ')}</small>
                          </div>
                        </button>
                      ))}
                      {savedAlbums.length === 0 && (
                        <p className="drawer-empty">No saved albums found.</p>
                      )}
                    </div>
                  )}

                  {librarySection === 'artists' && (
                    <div className="entity-list">
                      {followedArtists.map((artist) => (
                        <button
                          key={artist.id}
                          type="button"
                          className="entity-row"
                          onClick={() => {
                            onSearchQueryChange(artist.name);
                            onChangeTab('search');
                          }}
                        >
                          {artist.imageUrl ? (
                            <img src={artist.imageUrl} alt="" className="entity-avatar" />
                          ) : (
                            <div className="entity-avatar entity-avatar--blank" />
                          )}
                          <div className="entity-row__text">
                            <span>{artist.name}</span>
                            <small>{artist.genres?.slice(0, 2).join(' · ') || 'Artist'}</small>
                          </div>
                        </button>
                      ))}
                      {followedArtists.length === 0 && (
                        <p className="drawer-empty">No followed artists found.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'queue' && (
            <div className="drawer-section">
              {currentTrack && (
                <div className="queue-group">
                  <h3 className="drawer-subheading">Now playing</h3>
                  {renderTrackRow(currentTrack, 0, [currentTrack])}
                </div>
              )}

              <div className="queue-group">
                <h3 className="drawer-subheading">Next up</h3>
                {queue.length > 0 ? (
                  <div className="track-list">
                    {queue.map((t, i) => renderTrackRow(t, i, queue))}
                  </div>
                ) : (
                  <p className="drawer-empty">
                    Your queue is clear. Use the queue icon on any track in Search or Library to add it next.
                  </p>
                )}
              </div>
              <p className="hint-line">
                Spotify&apos;s Web API allows reading the queue and adding tracks to it, without removing or reordering queued items.
              </p>
            </div>
          )}
        </div>

        {addingTrack && (
          <div className="subsheet" role="dialog" aria-label="Add track to playlist">
            <div className="subsheet__head">
              <span>Add &ldquo;{addingTrack.name}&rdquo; to playlist</span>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setAddingTrack(null)}
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
            <div className="entity-list">
              {editablePlaylists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  className="entity-row"
                  onClick={async () => {
                    await onAddTrackToPlaylist(pl.id, addingTrack);
                    setAddingTrack(null);
                  }}
                >
                  {pl.imageUrl ? (
                    <img src={pl.imageUrl} alt="" className="track-thumb" />
                  ) : (
                    <div className="track-thumb track-thumb--blank" />
                  )}
                  <div className="entity-row__text">
                    <span>{pl.name}</span>
                    <small>{pl.tracks?.length ?? pl.tracksTotal} tracks</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
