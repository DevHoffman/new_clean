/*
 * Local preview server for the New Clean theme.
 *
 * Renders the theme's Liquid files with the real public catalogue and
 * simulates the storefront endpoints the theme talks to (cart, search,
 * recommendations, Section Rendering API). No Shopify login required.
 *
 * Usage: npm run preview   (then open http://localhost:3000)
 *
 * This is an approximation. Before publishing, validate on the real store
 * with `npm run dev` (shopify theme dev).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./lib/store');
const {
  THEME,
  createEngine,
  renderPage,
  renderSection,
  findSectionConfig,
  themeSettings,
  readThemeJson,
  escapeHtml,
} = require('./lib/engine');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const preview = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'preview.json'), 'utf8'));
// Test scenarios: PREVIEW_SETTINGS='{"pix_confirmed":false}' overrides theme settings for this run
Object.assign(preview.theme_settings, JSON.parse(process.env.PREVIEW_SETTINGS || '{}'));

/* Store policies come from the admin on a real store; here the drafts in docs/politicas are used */
function loadPolicies() {
  const dir = path.join(THEME, 'docs', 'politicas');
  if (!fs.existsSync(dir)) return [];
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (text) => escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .map((file) => {
      const handle = file.replace(/\.md$/, '');
      const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
      let title = handle;
      const html = [];
      let list = null;
      const closeList = () => {
        if (list) html.push(`</${list}>`);
        list = null;
      };
      lines.forEach((line) => {
        const text = line.trim();
        if (!text) return closeList();
        if (text.startsWith('# ')) {
          title = text.slice(2);
          return;
        }
        if (text.startsWith('## ')) {
          closeList();
          return html.push(`<h2>${inline(text.slice(3))}</h2>`);
        }
        const ordered = /^\d+\.\s/.test(text);
        if (text.startsWith('- ') || ordered) {
          const tag = ordered ? 'ol' : 'ul';
          if (list !== tag) {
            closeList();
            list = tag;
            html.push(`<${tag}>`);
          }
          return html.push(`<li>${inline(text.replace(/^(-|\d+\.)\s/, ''))}</li>`);
        }
        closeList();
        html.push(`<p>${inline(text)}</p>`);
      });
      closeList();
      return { handle, title, url: `/policies/${handle}`, body: html.join('\n') };
    });
}
const engine = createEngine();

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/* Resources that come from the Shopify admin on a real store
   ========================================================================== */
function buildLinklists(pathname) {
  const decorate = (links, level = 1) =>
    (links || []).map((link) => {
      const children = decorate(link.links, level + 1);
      const current = link.url === pathname;
      return {
        title: link.title,
        url: link.url,
        handle: store.handleize(link.title),
        type: 'http_link',
        levels: children.length ? (children.some((child) => child.links.length) ? 2 : 1) : 0,
        links: children,
        current,
        active: current,
        child_active: children.some((child) => child.current || child.child_active),
        child_current: children.some((child) => child.current),
      };
    });

  const result = {};
  Object.entries(preview.linklists).forEach(([handle, list]) => {
    result[handle] = { handle, title: list.title, links: decorate(list.links), levels: 3 };
  });
  return result;
}

function buildPages() {
  const result = {};
  Object.entries(preview.pages).forEach(([handle, page]) => {
    result[handle] = { ...page, handle, id: handle, url: `/pages/${handle}`, published_at: new Date().toISOString() };
  });
  return result;
}

/* Request context
   ========================================================================== */
function createRequest(req, url, sessionId) {
  const resources = { linklists: buildLinklists(url.pathname), pages: buildPages() };
  const settings = { ...themeSettings(resources), ...preview.theme_settings };
  const cart = store.buildCart(store.getCartState(sessionId));
  const origin = `http://${req.headers.host}`;
  const policies = loadPolicies();
  const findPolicy = (handle) => policies.find((policy) => policy.handle === handle) || { body: '', title: '', url: `/policies/${handle}` };

  const shop = {
    name: store.shopData.name || 'New Clean',
    description: store.shopData.description || '',
    url: origin,
    domain: req.headers.host,
    permanent_domain: store.shopData.myshopify_domain,
    email: 'contato@example.com',
    currency: 'BRL',
    money_format: 'R$ {{amount_with_comma_separator}}',
    money_with_currency_format: 'R$ {{amount_with_comma_separator}} BRL',
    enabled_payment_types: ['visa', 'master', 'elo', 'american_express', 'pix', 'boleto'],
    customer_accounts_enabled: true,
    customer_accounts_optional: true,
    policies,
    shipping_policy: findPolicy('shipping-policy'),
    refund_policy: findPolicy('refund-policy'),
    privacy_policy: findPolicy('privacy-policy'),
    terms_of_service: findPolicy('terms-of-service'),
    address: { city: store.shopData.city, province: store.shopData.province, country: 'Brazil' },
    checkout: { guest_login: false },
    products_count: store.products.length,
  };

  const routes = {
    root_url: '/',
    account_url: '/account',
    account_login_url: '/account/login',
    account_logout_url: '/account/logout',
    account_register_url: '/account/register',
    account_addresses_url: '/account/addresses',
    account_recover_url: '/account/recover',
    collections_url: '/collections',
    all_products_collection_url: '/collections/all',
    search_url: '/search',
    predictive_search_url: '/search/suggest',
    cart_url: '/cart',
    cart_add_url: '/cart/add',
    cart_change_url: '/cart/change',
    cart_clear_url: '/cart/clear',
    cart_update_url: '/cart/update',
    product_recommendations_url: '/recommendations/products',
  };

  const country = { iso_code: 'BR', name: 'Brasil', currency: { iso_code: 'BRL', symbol: 'R$', name: 'Real' } };

  const request = {
    pathname: url.pathname,
    query: url.searchParams,
    resources,
    sessionId,
    postedForm: url.searchParams.get('form_posted'),
    formError: url.searchParams.get('form_error'),
    template: null,
    globals: null,
  };

  request.globals = {
    __request: request,
    // LiquidJS resolves an undefined `size` variable to the number of globals
    size: null,
    first: null,
    last: null,
    settings,
    shop,
    routes,
    cart,
    customer: store.getCartState(sessionId).loggedIn ? store.buildCustomer() : null,
    linklists: resources.linklists,
    pages: resources.pages,
    collections: store.collectionsDrop(),
    all_products: Object.fromEntries(store.productsByHandle),
    localization: {
      country,
      available_countries: [country],
      language: { iso_code: 'pt-BR', name: 'Português (Brasil)', endonym_name: 'Português (Brasil)' },
      available_languages: [{ iso_code: 'pt-BR', name: 'Português (Brasil)' }],
    },
    request: {
      origin,
      host: req.headers.host,
      path: url.pathname,
      page_type: 'index',
      design_mode: false,
      visual_preview_mode: false,
      locale: { iso_code: 'pt-BR', name: 'Português (Brasil)', primary: true, root_url: '/' },
    },
    canonical_url: `${origin}${url.pathname}`,
    page_title: shop.name,
    page_description: '',
    page_image: null,
    current_page: parseInt(url.searchParams.get('page'), 10) || 1,
    current_tags: null,
    handle: '',
    powered_by_link: '',
    recommendations: { performed: false, products: [], products_count: 0 },
    predictive_search: { performed: false, terms: '', resources: { products: [], collections: [], queries: [], pages: [], articles: [] } },
    search: { performed: false, terms: '', results: [], results_count: 0, types: ['product'], filters: [], sort_options: [], sort_by: '' },
  };

  return request;
}

function setTemplate(request, name, suffix, pageType, extra = {}) {
  const candidates = suffix ? [`${name}.${suffix}`, name] : [name];
  const found = candidates.find((candidate) => fs.existsSync(path.join(THEME, 'templates', `${candidate}.json`)));
  if (!found) return false;
  const json = readThemeJson(`templates/${found}.json`);
  const parts = found.split('/').pop().split('.');
  request.template = {
    name: found.replace(/\//g, '-'),
    file: found,
    json,
    layout: json.layout === false ? null : json.layout || 'theme',
  };
  Object.assign(request.globals, extra, {
    template: { name: parts[0], suffix: parts[1] || null, directory: found.includes('/') ? 'customers' : null },
  });
  request.globals.request.page_type = pageType;
  return true;
}

/* Route → template
   ========================================================================== */
function resolveRoute(request) {
  const { pathname, query, globals } = request;
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (segments.length === 0) return setTemplate(request, 'index', null, 'index');

  if (segments[0] === 'products' && segments[1]) return productRoute(request, segments[1], null);

  if (segments[0] === 'collections') {
    if (!segments[1]) return setTemplate(request, 'list-collections', null, 'list-collections', { page_title: 'Coleções' });
    if (segments[2] === 'products' && segments[3]) return productRoute(request, segments[3], segments[1]);
    const collection = store.getCollection(segments[1], query);
    if (!collection) return false;
    return setTemplate(request, 'collection', null, 'collection', {
      collection,
      page_title: collection.title,
      handle: collection.handle,
    });
  }

  if (segments[0] === 'cart') return setTemplate(request, 'cart', null, 'cart', { page_title: 'Carrinho' });

  if (segments[0] === 'policies' && segments[1]) {
    const policy = globals.shop.policies.find((item) => item.handle === segments[1]);
    if (!policy || !policy.body) return false;
    // Shopify renders policies with this fixed markup inside the theme layout
    request.template = {
      name: 'policy',
      file: 'policy',
      json: null,
      layout: 'theme',
      html: `<div class="shopify-policy__container"><div class="shopify-policy__title"><h1>${policy.title}</h1></div><div class="shopify-policy__body"><div class="rte">${policy.body}</div></div></div>`,
    };
    Object.assign(globals, { page_title: policy.title, template: { name: 'policy', suffix: null, directory: null } });
    globals.request.page_type = 'policy';
    return true;
  }

  if (segments[0] === 'search') {
    const terms = query.get('q') || '';
    const performed = query.has('q') && terms.trim() !== '';
    let results = performed ? store.searchProducts(terms) : [];
    // Filters (availability, price) behave like Search & Discovery filters on the real store
    const faceted = store.buildFilters(results, query, '/search');
    if (performed) results = faceted.products;
    const sortBy = query.get('sort_by') || 'relevance';
    if (sortBy !== 'relevance') results = store.sortProducts(results, sortBy);
    Object.assign(globals.search, {
      performed,
      terms,
      results,
      results_count: results.length,
      sort_by: sortBy,
      default_sort_by: 'relevance',
      filters: performed ? faceted.filters : [],
      sort_options: [
        { value: 'relevance', name: 'Relevância' },
        { value: 'price-ascending', name: 'Preço, ordem crescente' },
        { value: 'price-descending', name: 'Preço, ordem decrescente' },
      ],
    });
    return setTemplate(request, 'search', null, 'search', { page_title: terms ? `Busca: ${terms}` : 'Busca' });
  }

  if (segments[0] === 'pages' && segments[1]) {
    const page = request.resources.pages[segments[1]];
    if (!page) return false;
    return setTemplate(request, 'page', page.template_suffix, 'page', { page, page_title: page.title, handle: page.handle });
  }

  if (segments[0] === 'account') {
    const customer = globals.customer;
    const sub = segments[1] || '';
    if (sub === 'login' || sub === 'recover') {
      if (customer) return { redirect: '/account' };
      return setTemplate(request, 'customers/login', null, 'customers/login', { page_title: 'Entrar' });
    }
    if (sub === 'register') {
      if (customer) return { redirect: '/account' };
      return setTemplate(request, 'customers/register', null, 'customers/register', { page_title: 'Criar conta' });
    }
    if (sub === 'activate') return setTemplate(request, 'customers/activate_account', null, 'customers/activate_account', { page_title: 'Ativar conta' });
    if (sub === 'reset') return setTemplate(request, 'customers/reset_password', null, 'customers/reset_password', { page_title: 'Redefinir senha' });
    if (sub === 'logout') {
      store.getCartState(request.sessionId).loggedIn = false;
      return { redirect: '/' };
    }
    if (!customer) return { redirect: '/account/login' };
    if (sub === 'orders' && segments[2]) {
      const order = customer.orders.find((item) => String(item.id) === segments[2] || item.name === `#${segments[2]}`);
      if (!order) return false;
      return setTemplate(request, 'customers/order', null, 'customers/order', { order, page_title: `Pedido ${order.name}` });
    }
    if (sub === 'addresses') return setTemplate(request, 'customers/addresses', null, 'customers/addresses', { page_title: 'Endereços' });
    return setTemplate(request, 'customers/account', null, 'customers/account', { page_title: 'Minha conta' });
  }

  return false;
}

function productRoute(request, handle, collectionHandle) {
  const product = store.productsByHandle.get(handle);
  if (!product) return false;
  const selected = request.query.get('variant');
  let current = product;
  if (selected) {
    const variant = product.variants.find((item) => String(item.id) === selected);
    if (variant) current = { ...product, selected_variant: variant, selected_or_first_available_variant: variant };
  }
  const extra = {
    product: current,
    page_title: product.title,
    page_image: product.featured_image,
    handle: product.handle,
  };
  if (collectionHandle) extra.collection = store.getCollection(collectionHandle);
  return setTemplate(request, 'product', null, 'product', extra);
}

/* Endpoints that render sections outside a page context */
function applyVirtualContext(request) {
  const { pathname, query, globals } = request;

  if (pathname === '/recommendations/products') {
    const limit = Math.min(10, parseInt(query.get('limit'), 10) || 4);
    const products = store.relatedProducts(query.get('product_id'), limit, query.get('intent') || 'related');
    globals.recommendations = { performed: true, products, products_count: products.length, intent: query.get('intent') || 'related' };
    globals.product = store.productsById.get(String(query.get('product_id'))) || null;
    globals.request.page_type = 'product';
    return true;
  }

  if (pathname === '/search/suggest') {
    const terms = query.get('q') || '';
    const limit = Math.min(10, parseInt(query.get('resources[limit]'), 10) || 6);
    const found = store.searchProducts(terms);
    const needle = store.normalize(terms);
    const collections = store.baseCollections.filter((item) => store.normalize(item.title).includes(needle)).slice(0, limit);

    // Query suggestions: the most common first words among the results
    const counts = new Map();
    found.forEach((product) => {
      const word = product.title.split(/\s+/)[0].toLowerCase();
      counts.set(word, (counts.get(word) || 0) + 1);
    });
    const queries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([text]) => ({ text, styled_text: text, url: `/search?q=${encodeURIComponent(text)}&type=product` }));

    globals.predictive_search = {
      performed: true,
      terms,
      types: ['product', 'collection', 'query'],
      resources: { products: found.slice(0, limit), collections, queries, pages: [], articles: [] },
    };
    globals.request.page_type = 'search';
    return true;
  }

  return false;
}

/* HTTP helpers
   ========================================================================== */
const zlib = require('zlib');

/* Text responses are gzipped, like Shopify's CDN does, so size measurements are realistic */
function send(res, status, body, headers = {}) {
  const type = String(headers['Content-Type'] || '');
  const acceptsGzip = /\bgzip\b/.test((res.req && res.req.headers['accept-encoding']) || '');
  if (acceptsGzip && /text|javascript|json|svg/.test(type) && body && body.length > 1024) {
    body = zlib.gzipSync(body);
    headers = { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' };
  }
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const sendJson = (res, status, data) => send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
const sendHtml = (res, status, html) => send(res, status, html, { 'Content-Type': 'text/html; charset=utf-8' });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(req, raw) {
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw || '{}');
    } catch (error) {
      return {};
    }
  }
  if (type.includes('multipart/form-data')) {
    const result = {};
    const pattern = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
    let match = pattern.exec(raw);
    while (match) {
      result[match[1]] = match[2];
      match = pattern.exec(raw);
    }
    return result;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function getSession(req, res) {
  const match = (req.headers.cookie || '').match(/preview_session=([a-f0-9]+)/);
  if (match) return match[1];
  const id = crypto.randomBytes(12).toString('hex');
  res.setHeader('Set-Cookie', `preview_session=${id}; Path=/; SameSite=Lax`);
  return id;
}

function contentForHeader(settings) {
  const families = [settings.font_heading, settings.font_body]
    .filter(Boolean)
    .map((font) => `family=${encodeURIComponent(font.google_name).replace(/%20/g, '+')}:wght@400;500;600;700;800`)
    .join('&');
  return `
    <!-- Pré-visualização local: fontes via Google Fonts (na Shopify elas vêm do CDN da plataforma) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap">
    <script>window.Shopify = { designMode: false, locale: 'pt-BR', currency: { active: 'BRL', rate: '1.0' }, routes: { root: '/' } };</script>
  `;
}

async function renderSections(request, ids) {
  const result = {};
  for (const id of ids) {
    const config = findSectionConfig(request, id);
    result[id] = config ? await renderSection(engine, request, config, config.group) : null;
  }
  return result;
}

/* A request for cart sections needs a page context to resolve template ids */
function contextFor(req, res, target, sessionId) {
  const url = new URL(target || '/', `http://${req.headers.host}`);
  const request = createRequest(req, url, sessionId);
  if (!applyVirtualContext(request)) resolveRoute(request);
  return request;
}

const sectionList = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 5);

/* Cart API
   ========================================================================== */
async function handleCartApi(req, res, url, sessionId) {
  const state = store.getCartState(sessionId);
  const route = url.pathname.replace(/\.js(on)?$/, '');
  const wantsJson = /\.js(on)?$/.test(url.pathname);
  const body = req.method === 'POST' ? parseBody(req, await readBody(req)) : {};

  const respond = async (payload) => {
    const ids = sectionList(body.sections);
    if (ids.length) {
      const request = contextFor(req, res, body.sections_url || req.headers.referer || '/', sessionId);
      payload.sections = await renderSections(request, ids);
    }
    return sendJson(res, 200, payload);
  };

  try {
    // Shipping estimate: simulated rates (the real ones come from the store's shipping settings)
    if (route === '/cart/shipping_rates' || route === '/cart/async_shipping_rates') {
      const zip = String(url.searchParams.get('shipping_address[zip]') || '').replace(/\D/g, '');
      if (zip.length !== 8) return sendJson(res, 422, { zip: ['CEP inválido'] });
      // Like the real Shopify: Brazilian rates need a state
      if ((url.searchParams.get('shipping_address[country]') || 'BR') === 'BR' && !url.searchParams.get('shipping_address[province]')) return sendJson(res, 422, { province: ['Selecione um estado'] });
      const cart = store.buildCart(state);
      const free = cart.total_price >= 15000;
      const local = zip.startsWith('29');
      return sendJson(res, 200, {
        shipping_rates: [
          { name: local ? 'Entrega New Clean (Grande Vitória) — simulação' : 'PAC — simulação', price: free ? '0.00' : local ? '9.90' : '19.90', delivery_days: local ? [1, 2] : [4, 8] },
          { name: 'Sedex — simulação', price: local ? '18.90' : '34.90', delivery_days: local ? [1] : [2, 3] },
        ],
      });
    }

    if (route === '/cart' && wantsJson) {
      return sendJson(res, 200, store.cartJson(store.buildCart(state)));
    }

    if (route === '/cart/add') {
      const entries = body.items || [{ id: body.id, quantity: body.quantity, properties: body.properties }];
      const keys = store.cartAdd(state, entries);
      if (!wantsJson) return send(res, 303, '', { Location: '/cart' });
      const cart = store.buildCart(state);
      const items = keys.map((key) => store.lineJson(cart.items.find((item) => item.key === key)));
      return respond(body.items ? { items } : items[0]);
    }

    if (route === '/cart/change') {
      store.cartChange(state, body);
      return respond(store.cartJson(store.buildCart(state)));
    }

    if (route === '/cart/update') {
      if (typeof body.note === 'string') state.note = body.note;
      if (body.attributes && typeof body.attributes === 'object') state.attributes = { ...(state.attributes || {}), ...body.attributes };
      if (body.updates && typeof body.updates === 'object') {
        Object.entries(body.updates).forEach(([id, quantity]) => {
          try {
            store.cartChange(state, { id, quantity });
          } catch (error) {
            // Ignore lines that are no longer in the cart
          }
        });
      }
      return respond(store.cartJson(store.buildCart(state)));
    }

    if (route === '/cart/clear') {
      state.lines = [];
      return respond(store.cartJson(store.buildCart(state)));
    }

    if (route === '/cart' && req.method === 'POST') {
      return sendHtml(res, 200, checkoutNotice(store.buildCart(state)));
    }
  } catch (error) {
    const status = error.status || 422;
    return sendJson(res, status, { status, message: 'Erro no carrinho', description: error.message });
  }
  return null;
}

function checkoutNotice(cart) {
  const total = (cart.total_price / 100).toFixed(2).replace('.', ',');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout</title>
  <body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:#f4f6fa;color:#0d1f3c">
  <div style="max-width:460px;margin:24px;padding:32px;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(13,31,60,.1);text-align:center">
  <h1 style="margin:0 0 12px;font-size:22px">Checkout indisponível na pré-visualização</h1>
  <p style="margin:0 0 8px;color:#5b6f8e">O checkout é processado pela Shopify e não faz parte do tema. Aqui o pedido terminaria com <strong>${cart.item_count} item(ns)</strong>, total de <strong>R$ ${total}</strong>.</p>
  <p style="margin:0 0 24px;color:#5b6f8e">Para testar o fluxo completo, use <code>npm run dev</code> com a loja conectada.</p>
  <a href="/cart" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#f5c227;color:#0d1f3c;font-weight:700;text-decoration:none">Voltar ao carrinho</a></div></body></html>`;
}

/* Server
   ========================================================================== */
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // Theme assets
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(THEME, 'assets', path.basename(decodeURIComponent(url.pathname)));
      if (!fs.existsSync(file)) return send(res, 404, 'Not found');
      return send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    }
    if (url.pathname === '/favicon.ico') return send(res, 204, '');
    // /discount/CODE?redirect=... — Shopify stores the code for checkout; here we just redirect
    if (url.pathname.startsWith('/discount/')) return send(res, 302, '', { Location: url.searchParams.get('redirect') || '/cart' });
    // /cart/123:2,456:1?checkout[email]=… — a cart permalink goes straight to the Shopify checkout
    if (/^\/cart\/\d+:\d+/.test(url.pathname)) {
      const rows = [...url.searchParams.entries()].map(([key, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b6f8e">${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join('');
      return sendHtml(res, 200, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:#f4f6fa;color:#0d1f3c"><div style="max-width:560px;margin:24px;padding:32px;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(13,31,60,.1)"><h1 style="margin:0 0 12px;font-size:22px">Checkout da Shopify (simulação)</h1><p style="color:#5b6f8e">Na loja real, este link abre o checkout com os itens <code>${escapeHtml(url.pathname.replace('/cart/', ''))}</code> e os dados abaixo já preenchidos:</p><table style="font-size:14px;margin:16px 0">${rows || '<tr><td>(nenhum dado)</td></tr>'}</table><a href="/cart" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#f5c227;color:#0d1f3c;font-weight:700;text-decoration:none">Voltar ao carrinho</a></div></body></html>`);
    }

    const sessionId = getSession(req, res);

    if (url.pathname.startsWith('/cart') && (url.pathname.endsWith('.js') || url.pathname.endsWith('shipping_rates.json') || req.method === 'POST')) {
      const handled = await handleCartApi(req, res, url, sessionId);
      if (handled !== null) return handled;
    }

    // Forms handled by Shopify (contact, newsletter, login…): echo a success state
    if (req.method === 'POST') {
      const body = parseBody(req, await readBody(req));
      const back = new URL(req.headers.referer || '/', `http://${req.headers.host}`);
      const state = store.getCartState(sessionId);

      if (body.form_type === 'customer_login') {
        const ok = String(body['customer[email]'] || '').trim().toLowerCase() === store.DEMO_CREDENTIALS.email && body['customer[password]'] === store.DEMO_CREDENTIALS.password;
        if (ok) {
          state.loggedIn = true;
          return send(res, 303, '', { Location: '/account' });
        }
        return send(res, 303, '', { Location: '/account/login?form_error=customer_login' });
      }
      if (body.form_type === 'create_customer' || body.form_type === 'activate_customer_password' || body.form_type === 'reset_customer_password') {
        state.loggedIn = true;
        return send(res, 303, '', { Location: '/account' });
      }
      if (body.form_type === 'recover_customer_password') {
        return send(res, 303, '', { Location: '/account/login?form_posted=recover_customer_password#recover' });
      }
      if (body.form_type === 'customer_address' || url.pathname.startsWith('/account/addresses')) {
        return send(res, 303, '', { Location: '/account/addresses' });
      }
      if (body.form_type === 'customer' || body.form_type === 'contact') {
        back.searchParams.set('form_posted', body.form_type);
      }
      return send(res, 303, '', { Location: back.pathname + back.search });
    }

    const request = createRequest(req, url, sessionId);
    const isVirtual = applyVirtualContext(request);
    const found = isVirtual || resolveRoute(request);
    if (found && found.redirect) return send(res, 302, '', { Location: found.redirect });

    // Section Rendering API
    if (url.searchParams.has('sections')) {
      return sendJson(res, 200, await renderSections(request, sectionList(url.searchParams.get('sections'))));
    }
    if (url.searchParams.has('section_id')) {
      const config = findSectionConfig(request, url.searchParams.get('section_id'));
      if (!config) return send(res, 404, 'Section not found');
      return sendHtml(res, 200, await renderSection(engine, request, config, config.group));
    }

    if (!found || isVirtual) {
      setTemplate(request, '404', null, '404', { page_title: 'Página não encontrada' });
      const html = await renderPage(engine, request, contentForHeader(request.globals.settings));
      return sendHtml(res, 404, html);
    }

    const html = await renderPage(engine, request, contentForHeader(request.globals.settings));
    sendHtml(res, 200, html);
    console.log(`  ${req.method} ${url.pathname}${url.search} → ${request.template.file} (${Date.now() - started}ms)`);
  } catch (error) {
    console.error(`  ✗ ${req.method} ${req.url}\n`, error);
    sendHtml(res, 500, `<pre style="padding:24px;white-space:pre-wrap;color:#c62828">${escapeHtml(error.stack || error.message)}</pre>`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORT} já está em uso. Feche o outro servidor ou rode: PORT=3001 npm run preview\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`\n  New Clean — pré-visualização local`);
  console.log(`  ${store.products.length} produtos carregados`);
  console.log(`  Conta de teste: ${store.DEMO_CREDENTIALS.email} / ${store.DEMO_CREDENTIALS.password}`);
  console.log(`\n  → http://localhost:${PORT}\n`);
});
