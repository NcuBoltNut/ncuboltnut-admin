// Phase B (read-only): fetches content straight from the public
// ncuboltnut.github.io repo. No auth needed — it's a public repo and we're
// only reading. Writing back (Phase C) will need GitHub OAuth + a token
// exchange backend; this file stays read-only until that lands.

const OWNER = 'NcuBoltNut';
const REPO = 'ncuboltnut.github.io';
const BRANCH = 'main';

export interface RepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

// Anonymous GitHub API calls are capped at 60/hour per IP — easy to burn
// through when several people share a network. Directory listings barely
// change, so cache them client-side for a few minutes to keep real-world
// usage well under that limit. A real fix (routing reads through an
// authenticated backend) arrives naturally with Phase C's write support.
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error('已達 GitHub 匿名 API 每小時查詢上限，請稍後再試（通常一小時內恢復）');
    }
    throw new Error(`GitHub API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function listDir(dirPath: string): Promise<RepoEntry[]> {
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

export async function fetchRaw(filePath: string): Promise<string> {
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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
}

async function authedApi<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { message?: string }).message ?? `${res.status}`;
    throw new Error(`GitHub API ${res.status}：${message}`);
  }
  return res.json() as Promise<T>;
}

/** Current SHA of a file, or null if it doesn't exist yet (for new files). */
export async function getFileSha(token: string, filePath: string): Promise<string | null> {
  try {
    const data = await authedApi<{ sha: string }>(
      token,
      `contents/${filePath}?ref=${BRANCH}`
    );
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
  await authedApi(token, `contents/${filePath}`, {
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
  await authedApi(token, `contents/${filePath}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
}
