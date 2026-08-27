// Phase C login: redirect the user to GitHub's OAuth authorize screen in a
// popup, GitHub redirects the popup to our Worker (worker/src/index.ts),
// which exchanges the code server-side and posts the resulting token back
// to this window. The token never appears in a URL bar or gets logged —
// it only ever exists in the postMessage payload and, after that,
// sessionStorage (cleared when the tab closes).

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
const AUTH_WORKER_ORIGIN = 'https://ncuboltnut-admin-auth.ncuboltnutrobotics.workers.dev';
const SESSION_KEY = 'bn-admin:github-token';

export function hasClientId(): boolean {
  return Boolean(CLIENT_ID);
}

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function randomState(): string {
  return crypto.randomUUID();
}

export function login(): Promise<string> {
  if (!CLIENT_ID) {
    return Promise.reject(new Error('缺少 VITE_GITHUB_CLIENT_ID，尚未設定 OAuth App'));
  }

  const state = randomState();
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', CLIENT_ID);
  authorizeUrl.searchParams.set('scope', 'repo');
  authorizeUrl.searchParams.set('state', state);

  const popup = window.open(authorizeUrl.toString(), 'bn-admin-login', 'width=600,height=720');
  if (!popup) {
    return Promise.reject(new Error('瀏覽器擋下了登入彈出視窗，請允許彈出視窗後再試一次'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(popupWatcher);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== AUTH_WORKER_ORIGIN) return;
      const data = event.data as
        | { source?: string; token?: string; error?: string; state?: string }
        | undefined;
      if (!data || data.source !== 'boltnut-admin-auth') return;

      settled = true;
      cleanup();

      if (data.state !== state) {
        reject(new Error('登入驗證失敗（state 不符），請重新登入'));
        return;
      }
      if (data.error || !data.token) {
        reject(new Error(`登入失敗：${data.error ?? '未知錯誤'}`));
        return;
      }

      try {
        sessionStorage.setItem(SESSION_KEY, data.token);
      } catch {
        // sessionStorage unavailable — token still resolves for this call,
        // just won't survive a reload.
      }
      resolve(data.token);
    };

    const popupWatcher = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('登入視窗已關閉'));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}
