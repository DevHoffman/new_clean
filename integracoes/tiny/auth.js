/*
 * One-time (and after 24 h without a run) authorization of the Tiny app.
 * Opens a local callback server, prints the consent URL, and saves the tokens.
 *
 *   TINY_CLIENT_ID=... TINY_CLIENT_SECRET=... npm run tiny:auth
 *
 * The redirect URI (default http://localhost:3456/callback) must be registered
 * in the Tiny application exactly as written.
 */
const http = require('http');
const config = require('./lib/config');
const tiny = require('./lib/tiny-client');

const redirect = new URL(config.tiny.redirectUri);
const state = `nc-${Date.now()}`;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, config.tiny.redirectUri);
  if (url.pathname !== redirect.pathname) {
    response.writeHead(404).end();
    return;
  }
  try {
    if (url.searchParams.get('state') !== state) throw new Error('state inválido');
    const code = url.searchParams.get('code');
    if (!code) throw new Error(url.searchParams.get('error_description') || 'o Tiny não devolveu o código');
    tiny.saveTokens(await tiny.exchangeCode(code));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>Tiny autorizado</h1><p>Pode fechar esta janela e voltar ao terminal.</p>');
    console.log('\n  Autorizado. Tokens salvos em', config.tiny.tokensFile, '\n');
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Erro: ${error.message}`);
    console.error(`\n  Erro: ${error.message}\n`);
  }
  server.close();
});

server.listen(Number(redirect.port) || 80, redirect.hostname, () => {
  console.log('\n  Abra este endereço no navegador, entre no Tiny e autorize o aplicativo:\n');
  console.log(`  ${tiny.authorizeUrl(state)}\n`);
  console.log(`  Aguardando o retorno em ${config.tiny.redirectUri} ...\n`);
});
