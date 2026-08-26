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
