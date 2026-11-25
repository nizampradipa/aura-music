const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const STORAGE_KEYS = {
  tokens: 'aura.spotify.tokens.v1',
  verifier: 'aura.spotify.pkce.verifier',
  state: 'aura.spotify.pkce.state',
  clientId: 'aura.spotify.client_id',
} as const;

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-follow-read',
].join(' ');

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

let inMemoryTokens: StoredTokens | null = null;
let refreshInFlight: Promise<StoredTokens> | null = null;

export function getConfiguredClientId(): string {
  const fromEnv = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem(STORAGE_KEYS.clientId)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveClientId(clientId: string): void {
  const trimmed = clientId.trim();
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.clientId, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEYS.clientId);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function getRedirectUri(): string {
  const fromEnv = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const origin = window.location.origin.replace('://localhost:', '://127.0.0.1:');
  return `${origin}/callback`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function sha256Base64Url(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

export function readStoredTokens(): StoredTokens | null {
  if (inMemoryTokens) return inMemoryTokens;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.tokens);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTokens;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    inMemoryTokens = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function persistTokens(tokens: StoredTokens): void {
  inMemoryTokens = tokens;
  try {
    sessionStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
  } catch {
    // ignore sessionStorage failure
  }
}

export function clearStoredTokens(): void {
  inMemoryTokens = null;
  refreshInFlight = null;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.tokens);
    sessionStorage.removeItem(STORAGE_KEYS.verifier);
    sessionStorage.removeItem(STORAGE_KEYS.state);
  } catch {
    // ignore
  }
}

export async function beginSpotifyLogin(explicitClientId?: string): Promise<void> {
  const clientId = (explicitClientId ?? getConfiguredClientId()).trim();
  if (!clientId) {
    throw new Error('Enter a Spotify Client ID first (from developer.spotify.com/dashboard).');
  }
  if (explicitClientId) {
    saveClientId(clientId);
  }

  const verifier = generateRandomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = generateRandomString(24);

  sessionStorage.setItem(STORAGE_KEYS.verifier, verifier);
  sessionStorage.setItem(STORAGE_KEYS.state, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES,
  });

  window.location.assign(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
}

export async function handleSpotifyCallback(searchParams: URLSearchParams): Promise<StoredTokens> {
  const error = searchParams.get('error');
  if (error) {
    throw new Error(
      error === 'access_denied'
        ? 'Spotify sign-in was cancelled. You can retry or explore Demo Mode.'
        : `Spotify authorization returned: ${error}`
    );
  }

  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const expectedState = sessionStorage.getItem(STORAGE_KEYS.state);
  const verifier = sessionStorage.getItem(STORAGE_KEYS.verifier);
  const clientId = getConfiguredClientId();

  if (!code) {
    throw new Error('Missing authorization code from Spotify.');
  }
  if (!expectedState || returnedState !== expectedState) {
    throw new Error('OAuth state mismatch. Please start sign-in again.');
  }
  if (!verifier || !clientId) {
    throw new Error('PKCE verifier or Client ID missing from this browser session.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Spotify token exchange failed (${res.status}): ${detail || res.statusText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  sessionStorage.removeItem(STORAGE_KEYS.verifier);
  sessionStorage.removeItem(STORAGE_KEYS.state);

  const tokens: StoredTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
  persistTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(): Promise<StoredTokens> {
  if (refreshInFlight) return refreshInFlight;

  const existing = readStoredTokens();
  const clientId = getConfiguredClientId();
  if (!existing?.refreshToken || !clientId) {
    clearStoredTokens();
    throw new Error('Your Spotify session expired. Please sign in again.');
  }

  refreshInFlight = (async () => {
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: existing.refreshToken,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      clearStoredTokens();
      throw new Error(`Unable to refresh Spotify session (${res.status}). Sign in again.`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    const updated: StoredTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || existing.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope || existing.scope,
    };
    persistTokens(updated);
    return updated;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * Returns a valid access token, proactively refreshing 2 minutes before expiry
 * so multi-hour ambient sessions are never interrupted.
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = readStoredTokens();
  if (!tokens) {
    throw new Error('Not signed in to Spotify.');
  }
  const twoMinutes = 2 * 60 * 1000;
  if (Date.now() + twoMinutes >= tokens.expiresAt) {
    const refreshed = await refreshAccessToken();
    return refreshed.accessToken;
  }
  return tokens.accessToken;
}
