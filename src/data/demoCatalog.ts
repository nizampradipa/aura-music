import type { AlbumSummary, ArtistSummary, ModePreset, MoodMode, Playlist, Track } from '../types/music';

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Art-directed minimalist record sleeves rendered cleanly as crisp SVG data URIs.
 * Canvas2D color extraction reads these directly without CORS failures, shifting the
 * entire room palette dynamically on every track change.
 */
const COVERS = {
  kyoto: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d1b36"/>
          <stop offset="55%" stop-color="#1b3c6e"/>
          <stop offset="100%" stop-color="#08101f"/>
        </linearGradient>
        <radialGradient id="s1" cx="68%" cy="32%" r="45%">
          <stop offset="0%" stop-color="#f2b866" stop-opacity="0.92"/>
          <stop offset="45%" stop-color="#c97b3a" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#1b3c6e" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g1)"/>
      <rect width="600" height="600" fill="url(#s1)"/>
      <g stroke="#e8f1ff" stroke-opacity="0.16" stroke-width="1">
        <line x1="0" y1="390" x2="600" y2="390"/>
        <line x1="0" y1="420" x2="600" y2="420"/>
        <line x1="0" y1="462" x2="600" y2="462"/>
        <line x1="0" y1="518" x2="600" y2="518"/>
      </g>
      <circle cx="406" cy="194" r="78" fill="#f3be72"/>
      <circle cx="406" cy="194" r="118" fill="none" stroke="#8fb8ee" stroke-opacity="0.32" stroke-width="1.5"/>
      <rect x="64" y="340" width="220" height="260" fill="#091326" fill-opacity="0.72"/>
      <rect x="108" y="290" width="76" height="310" fill="#13294d" fill-opacity="0.86"/>
      <rect x="196" y="370" width="14" height="190" fill="#f3be72" fill-opacity="0.78"/>
      <text x="48" y="76" fill="#dce9ff" fill-opacity="0.7" font-family="sans-serif" font-size="14" letter-spacing="5">STATION 04</text>
      <text x="48" y="556" fill="#dce9ff" fill-opacity="0.55" font-family="monospace" font-size="12" letter-spacing="3">ECM / NIGHT EDITIONS</text>
    </svg>
  `),
  terracotta: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="#4d1d14"/>
          <stop offset="50%" stop-color="#9e3b24"/>
          <stop offset="100%" stop-color="#240d09"/>
        </linearGradient>
        <linearGradient id="arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f2a86b"/>
          <stop offset="100%" stop-color="#bf512b"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g2)"/>
      <path d="M120 600 L120 270 A180 180 0 0 1 480 270 L480 600 Z" fill="url(#arch)" fill-opacity="0.9"/>
      <path d="M190 600 L190 315 A110 110 0 0 1 410 315 L410 600 Z" fill="#30120c"/>
      <circle cx="300" cy="245" r="44" fill="#fae2c0"/>
      <line x1="60" y1="450" x2="540" y2="450" stroke="#fae2c0" stroke-opacity="0.24" stroke-width="1.5"/>
      <text x="52" y="74" fill="#fbe2c4" fill-opacity="0.72" font-family="sans-serif" font-size="14" letter-spacing="6">WARM ROOMS</text>
    </svg>
  `),
  moss: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b241d"/>
          <stop offset="55%" stop-color="#1e5441"/>
          <stop offset="100%" stop-color="#0a1914"/>
        </linearGradient>
        <radialGradient id="s3" cx="35%" cy="42%" r="55%">
          <stop offset="0%" stop-color="#8de0b6" stop-opacity="0.62"/>
          <stop offset="60%" stop-color="#2c7559" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#0b241d" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g3)"/>
      <rect width="600" height="600" fill="url(#s3)"/>
      <g fill="none" stroke="#b9f2d5" stroke-opacity="0.34" stroke-width="1.5">
        <circle cx="240" cy="300" r="190"/>
        <circle cx="280" cy="300" r="150"/>
        <circle cx="320" cy="300" r="110"/>
        <circle cx="360" cy="300" r="70"/>
      </g>
      <rect x="330" y="96" width="180" height="408" rx="90" fill="#7cd4a8" fill-opacity="0.22" stroke="#c8f7df" stroke-opacity="0.36"/>
      <circle cx="420" cy="210" r="32" fill="#e0f7ea"/>
      <text x="48" y="544" fill="#c7f0da" fill-opacity="0.65" font-family="sans-serif" font-size="13" letter-spacing="5">GREENHOUSE NOCTURNES</text>
    </svg>
  `),
  harbor: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b2530"/>
          <stop offset="48%" stop-color="#165a6e"/>
          <stop offset="50%" stop-color="#071921"/>
          <stop offset="100%" stop-color="#0e3847"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g4)"/>
      <rect x="0" y="298" width="600" height="2" fill="#9de5f5" fill-opacity="0.55"/>
      <circle cx="300" cy="298" r="106" fill="#63cfe3" fill-opacity="0.88"/>
      <rect x="0" y="300" width="600" height="300" fill="#071820" fill-opacity="0.64"/>
      <g fill="#63cfe3" fill-opacity="0.34">
        <rect x="196" y="318" width="208" height="6"/>
        <rect x="218" y="336" width="164" height="5"/>
        <rect x="242" y="356" width="116" height="4"/>
        <rect x="262" y="378" width="76" height="3"/>
        <rect x="278" y="402" width="44" height="2"/>
      </g>
      <text x="48" y="76" fill="#c7f3fc" fill-opacity="0.7" font-family="sans-serif" font-size="14" letter-spacing="6">LOW WATER MARKS</text>
    </svg>
  `),
  velvet: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g5" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#290b1d"/>
          <stop offset="52%" stop-color="#782246"/>
          <stop offset="100%" stop-color="#140610"/>
        </linearGradient>
        <radialGradient id="s5" cx="55%" cy="46%" r="48%">
          <stop offset="0%" stop-color="#f08aa8" stop-opacity="0.82"/>
          <stop offset="55%" stop-color="#9c305c" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#290b1d" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g5)"/>
      <rect width="600" height="600" fill="url(#s5)"/>
      <rect x="100" y="100" width="400" height="400" fill="none" stroke="#ffd1df" stroke-opacity="0.3" stroke-width="1.5"/>
      <polygon points="100,450 320,160 500,450" fill="#eb7fa0" fill-opacity="0.76"/>
      <polygon points="220,450 390,230 500,450" fill="#2b0c1f" fill-opacity="0.82"/>
      <circle cx="195" cy="195" r="30" fill="#ffe2eb"/>
      <text x="100" y="544" fill="#ffd9e5" fill-opacity="0.68" font-family="sans-serif" font-size="13" letter-spacing="6">LAST TRAIN SOUTH</text>
    </svg>
  `),
  lanterns: encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g6" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#261b0b"/>
          <stop offset="55%" stop-color="#6e4b19"/>
          <stop offset="100%" stop-color="#140e06"/>
        </linearGradient>
        <radialGradient id="s6" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="#f5d284" stop-opacity="0.9"/>
          <stop offset="52%" stop-color="#c98e32" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#261b0b" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g6)"/>
      <rect width="600" height="600" fill="url(#s6)"/>
      <g stroke="#fce8b8" stroke-opacity="0.28" fill="none">
        <rect x="150" y="120" width="300" height="360" rx="150" stroke-width="1.5"/>
        <line x1="300" y1="60" x2="300" y2="540" stroke-width="1"/>
        <line x1="150" y1="300" x2="450" y2="300" stroke-width="1"/>
      </g>
      <circle cx="300" cy="270" r="64" fill="#f7da94"/>
      <circle cx="300" cy="340" r="40" fill="#4a310f" fill-opacity="0.8"/>
      <text x="52" y="76" fill="#fae7be" fill-opacity="0.72" font-family="sans-serif" font-size="14" letter-spacing="6">QUIET STUDIES</text>
    </svg>
  `),
};

export const DEMO_ARTISTS: ArtistSummary[] = [
  { id: 'art-haru', name: 'Haru Tanaka', uri: 'spotify:artist:demo_haru', imageUrl: COVERS.kyoto, genres: ['ambient', 'japanese electronic'] },
  { id: 'art-solana', name: 'Solana Trio', uri: 'spotify:artist:demo_solana', imageUrl: COVERS.terracotta, genres: ['nu-jazz', 'downtempo'] },
  { id: 'art-nora', name: 'Nora Lindholm', uri: 'spotify:artist:demo_nora', imageUrl: COVERS.moss, genres: ['modern classical', 'ambient'] },
  { id: 'art-kuro', name: 'Kuro & The Tides', uri: 'spotify:artist:demo_kuro', imageUrl: COVERS.harbor, genres: ['shoegaze', 'dream pop'] },
  { id: 'art-maren', name: 'Maren Okafor', uri: 'spotify:artist:demo_maren', imageUrl: COVERS.velvet, genres: ['alt r&b', 'nocturne'] },
  { id: 'art-sora', name: 'Sora Ensemble', uri: 'spotify:artist:demo_sora', imageUrl: COVERS.lanterns, genres: ['minimalist', 'tape loops'] },
];

export const DEMO_ALBUMS: AlbumSummary[] = [
  { id: 'alb-station04', name: 'Station 04 (Night Editions)', uri: 'spotify:album:demo_station04', imageUrl: COVERS.kyoto, releaseDate: '2025', artists: [DEMO_ARTISTS[0]], totalTracks: 8 },
  { id: 'alb-warmrooms', name: 'Warm Rooms', uri: 'spotify:album:demo_warmrooms', imageUrl: COVERS.terracotta, releaseDate: '2024', artists: [DEMO_ARTISTS[1]], totalTracks: 10 },
  { id: 'alb-greenhouse', name: 'Greenhouse Nocturnes', uri: 'spotify:album:demo_greenhouse', imageUrl: COVERS.moss, releaseDate: '2025', artists: [DEMO_ARTISTS[2]], totalTracks: 7 },
  { id: 'alb-lowwater', name: 'Low Water Marks', uri: 'spotify:album:demo_lowwater', imageUrl: COVERS.harbor, releaseDate: '2023', artists: [DEMO_ARTISTS[3]], totalTracks: 9 },
  { id: 'alb-lasttrain', name: 'Last Train South', uri: 'spotify:album:demo_lasttrain', imageUrl: COVERS.velvet, releaseDate: '2025', artists: [DEMO_ARTISTS[4]], totalTracks: 11 },
  { id: 'alb-quietstudies', name: 'Quiet Studies', uri: 'spotify:album:demo_quietstudies', imageUrl: COVERS.lanterns, releaseDate: '2024', artists: [DEMO_ARTISTS[5]], totalTracks: 6 },
];

export const DEMO_TRACKS: Track[] = [
  {
    id: 'trk-kyoto',
    uri: 'spotify:track:demo_kyoto',
    name: 'Kyoto Rainline',
    artists: [DEMO_ARTISTS[0]],
    album: DEMO_ALBUMS[0],
    durationMs: 214000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 50, // D3
      chords: [
        [0, 4, 7, 11, 14],
        [-3, 0, 4, 7, 11],
        [-5, 0, 2, 7, 12],
        [-7, -3, 0, 4, 9],
      ],
      tempoSeconds: 6.2,
    },
    demoLrc: `
[00:02.00]Sodium lamps along the empty glass
[00:08.50]Platform four is holding back the rain
[00:15.20]Every window keeps a second sky
[00:22.40]Blue and amber drifting out of frame
[00:30.00]
[00:34.20]Keep the lamp low while the city cools
[00:41.00]Footsteps fading past the cedar stairs
[00:48.50]All the static settles to a hum
[00:55.80]Warmth enough to leave the silence there
[01:04.00]
[01:10.50]Midnight local rolling off the bridge
[01:18.20]Silver water catching every line
[01:26.00]Nothing asking for a faster pace
[01:33.60]Just the slow return of quiet time
[01:44.00]Keep the lamp low while the city cools
[01:52.40]Let the night stay open till the dawn
    `.trim(),
  },
  {
    id: 'trk-terracotta',
    uri: 'spotify:track:demo_terracotta',
    name: 'Terracotta Tape',
    artists: [DEMO_ARTISTS[1]],
    album: DEMO_ALBUMS[1],
    durationMs: 238000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 53, // F3
      chords: [
        [0, 4, 7, 11],
        [-2, 2, 5, 9],
        [-5, 0, 4, 7],
        [-3, 0, 4, 10],
      ],
      tempoSeconds: 5.4,
    },
    demoLrc: `
[00:03.00]Dust across the needles and the clay
[00:10.20]Late October folding down the blinds
[00:17.50]Reel to reel we let the afternoon
[00:24.80]Stretch into a softer state of mind
[00:33.00]
[00:38.40]Copper shadow moving on the floor
[00:46.10]Coffee cooling by the record sleeve
[00:54.00]Every chord remembers where we stood
[01:02.30]Nothing hurried, nowhere left to leave
[01:14.00]Warm rooms keep the colour of the sun
[01:22.50]Long after the avenue goes dark
[01:31.20]Turn the dial down until it breathes
[01:40.00]Just a glow, an ember, and a spark
    `.trim(),
  },
  {
    id: 'trk-moss',
    uri: 'spotify:track:demo_moss',
    name: 'Moss & Sodium',
    artists: [DEMO_ARTISTS[2]],
    album: DEMO_ALBUMS[2],
    durationMs: 252000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 52, // E3
      chords: [
        [0, 3, 7, 10, 14],
        [-4, 0, 3, 7, 12],
        [-2, 2, 5, 9, 12],
        [-5, 0, 3, 7, 10],
      ],
      tempoSeconds: 7.1,
    },
    demoLrc: `
[00:03.50]Condensation on the winter glass
[00:12.00]Cedar leaves beneath a steady mist
[00:20.40]Quiet roots are listening below
[00:29.00]To the slower rhythms that exist
[00:39.00]
[00:45.20]Hold the green light in a northern room
[00:54.50]Let the cedar and the rain agree
[01:03.80]Not a hurry anywhere in sight
[01:13.00]Only breathing space and harmony
[01:26.00]Glasshouse lanterns burning through the fog
[01:36.20]Counting hours by the falling dew
    `.trim(),
  },
  {
    id: 'trk-harbor',
    uri: 'spotify:track:demo_harbor',
    name: 'Glass Harbor',
    artists: [DEMO_ARTISTS[3]],
    album: DEMO_ALBUMS[3],
    durationMs: 196000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 48, // C3
      chords: [
        [0, 7, 11, 14, 16],
        [-3, 4, 7, 11, 14],
        [-7, 0, 4, 7, 11],
        [-5, 2, 7, 9, 14],
      ],
      tempoSeconds: 5.8,
    },
    demoLrc: `
[00:02.50]Tide lines written in the morning salt
[00:09.60]Harbor bell across the channel haze
[00:16.80]Every ripple carries half a note
[00:24.10]Out beyond the timber and the bays
[00:32.00]
[00:36.80]Horizon splits the water from the air
[00:44.50]Cold and luminous and razor still
[00:52.40]Watch the lighthouse turn a steady arc
[01:00.80]Slow enough to let the room refill
[01:12.00]Drift out where the shallower waters clear
[01:21.40]Stay right at the edge of blue and grey
    `.trim(),
  },
  {
    id: 'trk-velvet',
    uri: 'spotify:track:demo_velvet',
    name: 'Velvet Transit',
    artists: [DEMO_ARTISTS[4]],
    album: DEMO_ALBUMS[4],
    durationMs: 224000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 55, // G3
      chords: [
        [0, 3, 7, 10, 14],
        [-4, 0, 3, 7, 11],
        [-7, -4, 0, 3, 7],
        [-2, 2, 5, 8, 12],
      ],
      tempoSeconds: 5.6,
    },
    demoLrc: `
[00:02.80]Neon fading on the tunnel wall
[00:09.90]Carriage lights are dimming one by one
[00:17.20]Half awake between the stops we know
[00:24.70]Watching midnight come and come undone
[00:34.00]
[00:39.00]Keep your coat around the quiet pulse
[00:46.80]Crimson reflections in the windowpane
[00:54.90]Every station feels a mile away
[01:03.20]Carried softly by the southern train
[01:14.50]Slow the tempo down to meet the dark
[01:23.00]Let the echo carry us back home
    `.trim(),
  },
  {
    id: 'trk-lanterns',
    uri: 'spotify:track:demo_lanterns',
    name: 'Paper Lanterns',
    artists: [DEMO_ARTISTS[5]],
    album: DEMO_ALBUMS[5],
    durationMs: 268000,
    externalUrl: 'https://open.spotify.com',
    demoHarmony: {
      rootMidi: 57, // A3
      chords: [
        [0, 4, 7, 11],
        [-5, 0, 4, 9],
        [-3, 2, 5, 9],
        [-7, -3, 0, 4],
      ],
      tempoSeconds: 6.8,
    },
    demoLrc: `
[00:04.00]Paper shade against a wooden beam
[00:12.40]Warmth enough to hold a winter night
[00:21.00]Pencil sketches on an open desk
[00:29.80]Resting in a pool of honey light
[00:40.00]
[00:46.50]Slow breath in and let the shoulders drop
[00:55.20]Every clock has wandered out of reach
[01:04.40]Small notes hanging in the quiet room
[01:13.80]Saying more than ordinary speech
[01:26.00]Leave the lantern glowing till we sleep
[01:36.50]Soft gold fading into cedar dark
    `.trim(),
  },
];

export const INITIAL_DEMO_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-focus',
    uri: 'spotify:playlist:demo_focus',
    name: 'Late Desk Focus',
    description: 'Low-distraction ambient & tape studies built for long deep-work blocks.',
    imageUrl: COVERS.kyoto,
    ownerId: 'demo-user',
    ownerName: 'You',
    collaborative: false,
    tracksTotal: 4,
    tracks: [DEMO_TRACKS[0], DEMO_TRACKS[2], DEMO_TRACKS[3], DEMO_TRACKS[5]],
  },
  {
    id: 'pl-chill',
    uri: 'spotify:playlist:demo_chill',
    name: 'Listening Room',
    description: 'Warm analog jazz, dream pop, and late afternoon vinyl cuts.',
    imageUrl: COVERS.terracotta,
    ownerId: 'demo-user',
    ownerName: 'You',
    collaborative: false,
    tracksTotal: 4,
    tracks: [DEMO_TRACKS[1], DEMO_TRACKS[4], DEMO_TRACKS[0], DEMO_TRACKS[3]],
  },
  {
    id: 'pl-night',
    uri: 'spotify:playlist:demo_night',
    name: 'After Hours',
    description: 'Dimmed, slow-moving nocturnes meant for a sleep timer and low lamp.',
    imageUrl: COVERS.lanterns,
    ownerId: 'demo-user',
    ownerName: 'You',
    collaborative: false,
    tracksTotal: 3,
    tracks: [DEMO_TRACKS[5], DEMO_TRACKS[2], DEMO_TRACKS[4]],
  },
];

export const DEFAULT_MODE_PRESETS: Record<MoodMode, ModePreset> = {
  focus: {
    id: 'focus',
    label: 'Focus',
    summary: 'Calm minimal field, chrome fades quickly, optional Pomodoro timer.',
    visualizer: 'pulse',
    motionScale: 0.45,
    brightness: 0.88,
    warmth: 0,
    autoHideMs: 3200,
    defaultLyricsOpen: false,
    linkedPlaylistId: 'pl-focus',
  },
  chill: {
    id: 'chill',
    label: 'Chill',
    summary: 'Rich adaptive colour field with fluid motion and synced lyrics.',
    visualizer: 'flow',
    motionScale: 1,
    brightness: 1,
    warmth: 0,
    autoHideMs: 6500,
    defaultLyricsOpen: true,
    linkedPlaylistId: 'pl-chill',
  },
  night: {
    id: 'night',
    label: 'Night',
    summary: 'Dimmed warm lamp tint, ultra-slow motion, sleep timer fade-out.',
    visualizer: 'orbit',
    motionScale: 0.3,
    brightness: 0.64,
    warmth: 0.34,
    autoHideMs: 4200,
    defaultLyricsOpen: true,
    linkedPlaylistId: 'pl-night',
  },
};
