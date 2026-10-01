/* Settings come from environment variables (never from files in the repository). */
const path = require('path');

const env = process.env;
const need = (name) => {
  if (!env[name]) throw new Error(`Defina a variável de ambiente ${name}`);
  return env[name];
};

module.exports = {
  need,
  tiny: {
    get clientId() { return need('TINY_CLIENT_ID'); },
    get clientSecret() { return need('TINY_CLIENT_SECRET'); },
    redirectUri: env.TINY_REDIRECT_URI || 'http://localhost:3456/callback',
    authBase: env.TINY_AUTH_BASE || 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect',
    apiBase: env.TINY_API_BASE || 'https://api.tiny.com.br/public-api/v3',
    // Where the rotating tokens live between runs (keep it on persistent storage, out of git)
    tokensFile: env.TINY_TOKENS_FILE || path.join(__dirname, '..', '.tokens.json'),
  },
  shopify: {
    store: env.SHOPIFY_STORE || 'dfd10g-i2.myshopify.com',
    version: env.SHOPIFY_API_VERSION || '2025-07',
    endpoint: env.SHOPIFY_ENDPOINT || null,
    get token() { return need('SHOPIFY_ADMIN_TOKEN'); },
    locationId: env.SHOPIFY_LOCATION_ID || null,
  },
  stateFile: env.TINY_STATE_FILE || path.join(__dirname, '..', '.state.json'),
  outDir: path.join(__dirname, '..', 'out'),
};
