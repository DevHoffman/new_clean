/*
 * Olist Tiny ERP API v3 client (OAuth 2, Keycloak).
 *
 * Tokens: the access token lasts about 4 hours and the refresh token about a
 * day, and the refresh token ROTATES: every refresh returns a new one that must
 * be saved, or the next run will be locked out and need a new consent (npm run tiny:auth).
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(config.tiny.tokensFile, 'utf8'));
  } catch (error) {
    return null;
  }
}

function saveTokens(tokens) {
  const file = config.tiny.tokensFile;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write to a temp file first so a crash never leaves a half-written (lost) refresh token
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

function tokensFromResponse(body) {
  const now = Date.now();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: now + (body.expires_in || 14400) * 1000,
    refresh_expires_at: now + (body.refresh_expires_in || 86400) * 1000,
    saved_at: new Date(now).toISOString(),
  };
}

async function tokenRequest(form) {
  const response = await fetch(`${config.tiny.authBase}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.tiny.clientId, client_secret: config.tiny.clientSecret, ...form }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tiny recusou o token (HTTP ${response.status}): ${text.slice(0, 300)}`);
  return tokensFromResponse(JSON.parse(text));
}

const authorizeUrl = (state = 'new-clean') =>
  `${config.tiny.authBase}/auth?${new URLSearchParams({ client_id: config.tiny.clientId, redirect_uri: config.tiny.redirectUri, scope: 'openid', response_type: 'code', state })}`;

const exchangeCode = (code) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.tiny.redirectUri });

async function accessToken(force = false) {
  let tokens = readTokens();
  if (!tokens) throw new Error('Sem tokens do Tiny. Rode: npm run tiny:auth');
  if (force || tokens.expires_at - Date.now() < 5 * 60 * 1000) {
    if (tokens.refresh_expires_at && tokens.refresh_expires_at < Date.now()) {
      throw new Error('A autorização do Tiny expirou (passou de 24 h sem renovar). Rode: npm run tiny:auth');
    }
    tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    saveTokens(tokens);
  }
  return tokens.access_token;
}

async function request(pathname, { query = {}, attempt = 0, refreshed = false } = {}) {
  const url = new URL(`${config.tiny.apiBase}${pathname}`);
  Object.entries(query).forEach(([key, value]) => value !== undefined && value !== '' && url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json' } });

  if (response.status === 401 && !refreshed) {
    await accessToken(true);
    return request(pathname, { query, attempt, refreshed: true });
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const reset = Number(response.headers.get('X-RateLimit-Reset'));
    await sleep(response.status === 429 && reset ? Math.min(reset, 60) * 1000 : 1000 * 2 ** attempt);
    return request(pathname, { query, attempt: attempt + 1, refreshed });
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`Tiny ${pathname} → HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/* Every product of the list, page by page */
async function* listProducts(filters = {}) {
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await request('/produtos', { query: { limit, offset, ...filters } });
    const items = page.itens || [];
    for (const item of items) yield item;
    const total = page.paginacao && page.paginacao.total;
    if (!items.length || (total !== undefined && offset + limit >= total)) return;
  }
}

module.exports = {
  authorizeUrl,
  exchangeCode,
  saveTokens,
  readTokens,
  listProducts,
  getProduct: (id) => request(`/produtos/${id}`),
  getStock: (id) => request(`/estoque/${id}`),
};
