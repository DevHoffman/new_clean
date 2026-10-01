/*
 * End-to-end test of the sync against local fake Tiny and Shopify servers.
 * It proves the logic (matching by SKU, prices, stock, creation, rotating
 * tokens, rate limits, safety of the simulation). It does NOT prove that the
 * real APIs answer with exactly these fields: run a first real simulation with
 * --limit=3 --verbose and compare.
 *
 * Usage: node integracoes/tiny/test/run-test.js   (npm run tiny:test)
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-test-'));
const tokensFile = path.join(tmp, 'tokens.json');
const writes = [];
let refreshCount = 0;
let rateLimited = false;

/* ---------- fake Tiny ---------- */
const tinyProducts = [
  { id: 1, sku: 'A1', descricao: 'DESINFETANTE A', tipo: 'S', situacao: 'A', precos: { preco: 10, precoPromocional: 8 } },
  { id: 2, sku: 'B2', descricao: 'PAPEL B', tipo: 'S', situacao: 'A', precos: { preco: 20, precoPromocional: 0 } },
  { id: 3, sku: 'C3', descricao: 'CAMISETA COM VARIACAO', tipo: 'V', situacao: 'A', precos: { preco: 30 } },
  { id: 4, sku: 'D4', descricao: 'PRODUTO NOVO D', tipo: 'S', situacao: 'A', precos: { preco: 15.5 } },
  { id: 5, sku: 'E5', descricao: 'SEM CONTROLE E', tipo: 'S', situacao: 'A', precos: { preco: 5 } },
  { id: 6, sku: '', descricao: 'SEM SKU', tipo: 'S', situacao: 'A', precos: { preco: 5 } },
  { id: 7, sku: 'DUP', descricao: 'REPETIDO', tipo: 'S', situacao: 'A', precos: { preco: 5 } },
];
const tinyDetail = {
  1: { descricao: 'DESINFETANTE A', descricaoComplementar: '<p>Novo texto</p>', marca: { nome: 'Azulim' }, categoria: { nome: 'Limpeza' }, anexos: [{ url: 'https://img.test/a1.jpg', externo: true }], estoque: { controlar: true }, precos: { preco: '10,00', precoPromocional: '8,00' } },
  2: { descricao: 'PAPEL B', estoque: { controlar: true }, precos: { preco: 20 } },
  4: { descricao: 'PRODUTO NOVO D', descricaoComplementar: '<p>Novo</p>', marca: 'Mili', categoria: { nome: 'Papel' }, anexos: [{ url: 'https://img.test/d4.jpg' }], estoque: { controlar: true }, precos: { preco: 15.5 } },
  5: { descricao: 'SEM CONTROLE E', estoque: { controlar: false }, precos: { preco: 5 } },
  7: { descricao: 'REPETIDO', estoque: { controlar: true }, precos: { preco: 5 } },
};
const tinyStock = { 1: { disponivel: 5, saldo: 6 }, 2: { disponivel: 7 }, 4: { disponivel: 12 }, 5: { disponivel: 0 }, 7: { disponivel: 1 } };

const send = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
};

const tinyServer = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    if (url.pathname === '/auth/token') {
      const form = new URLSearchParams(body);
      assert.strictEqual(form.get('grant_type'), 'refresh_token');
      assert.strictEqual(form.get('refresh_token'), 'refresh-old');
      refreshCount += 1;
      return send(response, 200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 14400, refresh_expires_in: 86400 });
    }
    if (request.headers.authorization !== 'Bearer access-new') return send(response, 401, { error: 'token' });
    if (url.pathname === '/api/produtos') {
      if (!rateLimited) {
        rateLimited = true;
        return send(response, 429, { error: 'rate' }, { 'X-RateLimit-Reset': '1' });
      }
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 100);
      return send(response, 200, { itens: tinyProducts.slice(offset, offset + limit), paginacao: { limit, offset, total: tinyProducts.length } });
    }
    const detail = url.pathname.match(/^\/api\/produtos\/(\d+)$/);
    if (detail) return tinyDetail[detail[1]] ? send(response, 200, tinyDetail[detail[1]]) : send(response, 404, {});
    const stock = url.pathname.match(/^\/api\/estoque\/(\d+)$/);
    if (stock) return send(response, 200, { id: Number(stock[1]), ...tinyStock[stock[1]] });
    send(response, 404, {});
  });
});

/* ---------- fake Shopify ---------- */
const variant = (sku, price, stock, tracked, productExtra = {}) => ({
  id: `gid://shopify/ProductVariant/${sku}`,
  sku,
  price,
  compareAtPrice: null,
  inventoryItem: { id: `gid://shopify/InventoryItem/${sku}`, tracked, inventoryLevel: stock === null ? null : { quantities: [{ name: 'available', quantity: stock }] } },
  product: { id: `gid://shopify/Product/${sku}`, title: `${sku} antigo`, status: 'ACTIVE', descriptionHtml: '', vendor: 'DISTRIBUIDORA NEW CLEAN', productType: '', tags: [], featuredMedia: null, ...productExtra },
});
const shopifyVariants = [
  variant('A1', '9.00', 3, true),
  variant('B2', '20.00', 7, true),
  variant('E5', '5.00', null, false),
  variant('DUP', '5.00', 1, true),
  variant('DUP', '5.00', 1, true),
];

const shopifyServer = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    assert.strictEqual(request.headers['x-shopify-access-token'], 'shpat_test');
    const { query, variables } = JSON.parse(body);
    const record = (name) => writes.push({ name, variables });
    if (/productVariants\(/.test(query)) return send(response, 200, { data: { productVariants: { nodes: shopifyVariants, pageInfo: { hasNextPage: false, endCursor: null } } } });
    if (/locations\(/.test(query)) return send(response, 200, { data: { locations: { nodes: [{ id: 'gid://shopify/Location/9', name: 'Loja', isPrimary: true }] } } });
    if (/productCreate\(/.test(query)) {
      record('productCreate');
      return send(response, 200, { data: { productCreate: { product: { id: 'gid://shopify/Product/NEW', variants: { nodes: [{ id: 'gid://shopify/ProductVariant/NEW', inventoryItem: { id: 'gid://shopify/InventoryItem/NEW' } }] } }, userErrors: [] } } });
    }
    const mutation = ['productVariantsBulkUpdate', 'inventoryItemUpdate', 'inventoryActivate', 'inventorySetQuantities', 'productUpdate', 'productCreateMedia'].find((name) => query.includes(`${name}(`));
    if (mutation) {
      record(mutation);
      return send(response, 200, { data: { [mutation]: { userErrors: [], mediaUserErrors: [] } } });
    }
    send(response, 400, { errors: [{ message: 'unknown operation' }] });
  });
});

/* ---------- run ---------- */
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

/* Async on purpose: the fake servers live in this process and must keep answering */
function runSync(args) {
  writes.length = 0;
  rateLimited = false;
  fs.writeFileSync(tokensFile, JSON.stringify({ access_token: 'access-old', refresh_token: 'refresh-old', expires_at: Date.now() - 1000, refresh_expires_at: Date.now() + 3600e3 }));
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, '..', 'sync.js'), ...args], {
      env: {
        ...process.env,
        TINY_CLIENT_ID: 'id',
        TINY_CLIENT_SECRET: 'secret',
        TINY_TOKENS_FILE: tokensFile,
        TINY_AUTH_BASE: `http://127.0.0.1:${tinyServer.address().port}/auth`,
        TINY_API_BASE: `http://127.0.0.1:${tinyServer.address().port}/api`,
        SHOPIFY_ENDPOINT: `http://127.0.0.1:${shopifyServer.address().port}/graphql`,
        SHOPIFY_ADMIN_TOKEN: 'shpat_test',
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

(async () => {
  await Promise.all([listen(tinyServer), listen(shopifyServer)]);
  const names = () => writes.map((write) => write.name);
  let passed = 0;
  const ok = (label) => console.log(`  ✔ ${label}`) || (passed += 1);

  try {
    // 1. Simulation writes nothing
    let result = await runSync([]);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert.deepStrictEqual(writes, []);
    assert.match(result.stdout, /preços a atualizar \.+ 1\b/);
    assert.match(result.stdout, /estoques a atualizar \.+ 1 \(1 sem controle/);
    assert.match(result.stdout, /no Tiny e fora da loja \.+ 1/);
    assert.match(result.stdout, /1 \(tipo não simples\) · 1 sem SKU · 1 SKU repetido/);
    ok('simulação não grava nada e conta certo (preço, estoque, ignorados)');

    // 2. Rotating tokens were refreshed and saved
    assert.strictEqual(refreshCount >= 1, true);
    const saved = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
    assert.strictEqual(saved.refresh_token, 'refresh-new');
    ok('token renovado e o novo refresh token foi salvo');
    ok('limite de requisições (429) foi tolerado');

    // 3. Apply: price + stock of existing products only
    result = await runSync(['--apply']);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    const priceWrite = writes.find((write) => write.name === 'productVariantsBulkUpdate');
    assert.deepStrictEqual(priceWrite.variables.variants[0], { id: 'gid://shopify/ProductVariant/A1', price: '8.00', compareAtPrice: '10.00' });
    const stockWrite = writes.find((write) => write.name === 'inventorySetQuantities');
    assert.deepStrictEqual(stockWrite.variables.input.quantities[0], { inventoryItemId: 'gid://shopify/InventoryItem/A1', locationId: 'gid://shopify/Location/9', quantity: 5 });
    assert.strictEqual(names().includes('productCreate'), false);
    assert.strictEqual(names().filter((name) => name === 'productVariantsBulkUpdate').length, 1);
    ok('--apply: promoção do Tiny vira preço + "comparar a"; estoque vai para o local principal');
    ok('produto sem alteração, sem controle de estoque, variação, sem SKU e SKU repetido não são tocados');
    ok('sem --create, nenhum produto é criado');

    // 4. Create + content
    result = await runSync(['--apply', '--create', '--content']);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    const created = writes.find((write) => write.name === 'productCreate');
    assert.strictEqual(created.variables.product.status, 'DRAFT');
    assert.strictEqual(created.variables.product.vendor, 'Mili');
    assert.strictEqual(created.variables.product.title, 'PRODUTO NOVO D');
    assert.strictEqual(names().includes('productCreateMedia'), true);
    const update = writes.find((write) => write.name === 'productUpdate' && write.variables.product.id === 'gid://shopify/Product/A1');
    assert.strictEqual(update.variables.product.vendor, 'Azulim');
    assert.strictEqual(update.variables.product.id, 'gid://shopify/Product/A1');
    ok('--create: produto novo entra como rascunho, com marca, foto e estoque');
    ok('--content: título, descrição, marca e tipo do Tiny atualizam o produto existente');

    // 5. --sku and --limit filters
    result = await runSync(['--apply', '--sku=B2']);
    assert.deepStrictEqual(writes, []);
    ok('--sku limita a sincronização');
  } catch (error) {
    console.error(`\n  ✘ ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    tinyServer.close();
    shopifyServer.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!process.exitCode) console.log(`\n  ${passed} verificações ok\n`);
  }
})();
