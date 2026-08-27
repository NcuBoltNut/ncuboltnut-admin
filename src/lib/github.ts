// Reads content from the public ncuboltnut.github.io repo, two ways:
//
// - Anonymous (no token): via api.github.com (listings) and
//   raw.githubusercontent.com (file bodies). Works for everyone, but
//   raw.githubusercontent.com sits behind a CDN that can serve a stale
//   cached copy for a few minutes right after a commit — fine for casual
//   browsing, wrong for "did my save just take?".
// - Authenticated (token from a logged-in session): every read goes
//   through api.github.com's Contents API instead, which reflects commits
//   immediately (no CDN in front of it) and carries the 5000/hour
//   authenticated rate limit instead of the 60/hour anonymous one. Once a
//   token exists there's no reason to prefer the anonymous path, so writes
//   (Phase C) always read this way before/after mutating a file.

const OWNER = 'NcuBoltNut';
const REPO = 'ncuboltnut.github.io';
const BRANCH = 'main';

export interface RepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function api<T>(path: string, token?: string, init?: Omit<RequestInit, 'headers'>): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: authHeaders(token),
  });
  if (!res.ok) {
    if (!token && (res.status === 403 || res.status === 429)) {
      throw new Error('已達 GitHub 匿名 API 每小時查詢上限，請稍後再試（通常一小時內恢復）');
    }
    const body = await res.json().catch(() => ({}));
    const message = (body as { message?: string }).message ?? `${res.status}`;
    throw new Error(`GitHub API ${res.status}：${message}`);
  }
  return res.json() as Promise<T>;
}

/** Base64 (as GitHub's Contents API returns it) → a proper UTF-8 string. */
function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export async function listDir(dirPath: string, token?: string): Promise<RepoEntry[]> {
  // Logged in: always fetch fresh. The whole point of the cache is to stay
  // under the *anonymous* rate limit; an authenticated caller has 5000/hour
  // and, more importantly, needs to see files they just added/removed.
  if (token) {
    return api<RepoEntry[]>(`contents/${dirPath}?ref=${BRANCH}`, token);
  }

  const cacheKey = `bn-admin:listDir:${dirPath}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { entries, cachedAt } = JSON.parse(cached) as {
        entries: RepoEntry[];
        cachedAt: number;
      };
      if (Date.now() - cachedAt < LIST_CACHE_TTL_MS) return entries;
    }
  } catch {
    // sessionStorage unavailable (private mode, etc.) — just skip the cache.
  }

  const entries = await api<RepoEntry[]>(`contents/${dirPath}?ref=${BRANCH}`);
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ entries, cachedAt: Date.now() }));
  } catch {
    // storage full or unavailable — fine, just means no caching this time.
  }
  return entries;
}

/**
 * Reads a file's content. Pass the logged-in user's token when you have one
 * — besides the higher rate limit, it's the only way to reliably see a
 * change made moments ago (see the module doc comment above).
 */
export async function fetchRaw(filePath: string, token?: string): Promise<string> {
  if (token) {
    const data = await api<{ content: string; encoding: string }>(
      `contents/${filePath}?ref=${BRANCH}`,
      token
    );
    return data.encoding === 'base64' ? base64ToUtf8(data.content) : data.content;
  }

  const res = await fetch(
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${filePath}`
  );
  if (!res.ok) {
    throw new Error(`raw.githubusercontent.com ${res.status} for ${filePath}`);
  }
  return res.text();
}

export function repoFileUrl(filePath: string): string {
  return `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${filePath}`;
}

// ---------------------------------------------------------------------
// Phase C: authenticated writes. Every call below requires a GitHub OAuth
// token (scope: repo) obtained via src/lib/auth.ts — never call these
// anonymously, and never let the token leak into a URL or log line.
// ---------------------------------------------------------------------

/** Current SHA of a file, or null if it doesn't exist yet (for new files). */
export async function getFileSha(token: string, filePath: string): Promise<string | null> {
  try {
    const data = await api<{ sha: string }>(`contents/${filePath}?ref=${BRANCH}`, token);
    return data.sha;
  } catch {
    return null;
  }
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

/**
 * Create or update a single file as one commit. Pass `sha` (from
 * getFileSha) when overwriting an existing file — omit it only when the
 * file is new, otherwise GitHub rejects the write as a conflict.
 */
export async function putFile(
  token: string,
  filePath: string,
  content: string,
  message: string,
  sha?: string | null
): Promise<void> {
  await api(`contents/${filePath}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: utf8ToBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function deleteFile(
  token: string,
  filePath: string,
  message: string,
  sha: string
): Promise<void> {
  await api(`contents/${filePath}`, token, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
}

/**
 * Uploads a binary asset (an image) as one commit. `base64Content` should
 * be the raw base64 payload with no "data:...;base64," prefix.
 */
export async function putBinaryFile(
  token: string,
  filePath: string,
  base64Content: string,
  message: string,
  sha?: string | null
): Promise<void> {
  await api(`contents/${filePath}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}
