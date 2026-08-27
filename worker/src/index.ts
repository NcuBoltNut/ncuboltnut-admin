// Thin OAuth token-exchange for the BoltNut CMS (Phase C).
//
// The admin SPA (static, on GitHub Pages) can't hold a GitHub OAuth Client
// Secret — anything shipped to the browser is public. This Worker is the
// only piece that ever sees the secret: it takes the authorization `code`
// GitHub hands back, exchanges it server-side for an access token, and
// hands that token to the SPA via postMessage to a popup window (never in
// a URL, never logged, never touches localStorage on this end).
//
// The SPA opens this at /callback as a popup after redirecting the user to
// GitHub's authorize screen; see src/lib/auth.ts in the main app.

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/callback') {
      return new Response('Not found', { status: 404 });
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') ?? '';
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      return htmlResult(env.ALLOWED_ORIGIN, { error: oauthError, state });
    }
    if (!code) {
      return htmlResult(env.ALLOWED_ORIGIN, { error: 'missing_code', state });
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenJson = (await tokenRes.json()) as GitHubTokenResponse;

    if (!tokenJson.access_token) {
      return htmlResult(env.ALLOWED_ORIGIN, {
        error: tokenJson.error ?? 'exchange_failed',
        state,
      });
    }

    return htmlResult(env.ALLOWED_ORIGIN, { token: tokenJson.access_token, state });
  },
};

function htmlResult(allowedOrigin: string, payload: Record<string, string>) {
  const message = JSON.stringify({ source: 'boltnut-admin-auth', ...payload });
  const originJson = JSON.stringify(allowedOrigin);
  const html = `<!doctype html>
<html lang="zh-TW">
<body style="font-family:system-ui;padding:40px;text-align:center;">
  <p>登入處理中，這個視窗會自動關閉…</p>
  <script>
    if (window.opener) {
      window.opener.postMessage(${message}, ${originJson});
    }
    window.close();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
