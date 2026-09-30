/*
 * Prepares the store through the Shopify Admin API: automatic collections,
 * pages and menus that the theme expects (docs/REQUISITOS.md R23, R24, R28, R29).
 *
 * Safe by default: without --apply it only prints what it would do.
 * It never deletes anything and never touches products, prices or policies.
 *
 *   SHOPIFY_ADMIN_TOKEN=shpat_... node dev/admin/setup-store.js          # simulation
 *   SHOPIFY_ADMIN_TOKEN=shpat_... node dev/admin/setup-store.js --apply  # creates
 *
 * Token: Admin > Configurações > Apps > Desenvolver apps > Criar app > API Admin with
 * write_products, read_products, write_content, read_content,
 * write_online_store_navigation, read_online_store_navigation.
 *
 * Options: --only=collections,pages,menus   (default: all three)
 *          --by-tag   for the TEST store filled with docs/catalogo/produtos-importacao.csv:
 *                     Mais vendidos and Novidades are built from the tags of that sample
 *                     (mais-vendidos, novidades) instead of taking every product.
 */
const groups = require('../lib/category-groups');
const slug = require('../lib/slug');

const SITE = 'https://www.distribuidoranewclean.com.br';
const STORE = process.env.SHOPIFY_STORE || 'dfd10g-i2.myshopify.com';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const ENDPOINT = process.env.SHOPIFY_ADMIN_ENDPOINT || `https://${STORE}/admin/api/2025-07/graphql.json`;
const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : ['collections', 'pages', 'menus'];
const BY_TAG = process.argv.includes('--by-tag');

/* Collections that are not category rules */
const SPECIAL = [
  {
    title: 'Mais vendidos',
    handle: 'mais-vendidos',
    sortOrder: 'BEST_SELLING',
    rules: BY_TAG ? [{ column: 'TAG', relation: 'EQUALS', condition: 'mais-vendidos' }] : [{ column: 'VARIANT_PRICE', relation: 'GREATER_THAN', condition: '0' }],
  },
  {
    title: 'Ofertas',
    handle: 'ofertas',
    sortOrder: 'BEST_SELLING',
    // Only products whose compare-at price is above the price
    rules: [{ column: 'IS_PRICE_REDUCED', relation: 'IS_SET', condition: '' }],
  },
  {
    title: 'Novidades',
    handle: 'novidades',
    sortOrder: 'CREATED_DESC',
    rules: BY_TAG ? [{ column: 'TAG', relation: 'EQUALS', condition: 'novidades' }] : [{ column: 'VARIANT_PRICE', relation: 'GREATER_THAN', condition: '0' }],
  },
];

const CATEGORY_COLLECTIONS = Object.entries(groups).map(([title, words]) => ({
  title,
  handle: slug(title),
  sortOrder: 'BEST_SELLING',
  // Any of the words at the start of the title
  disjunctive: true,
  rules: words.map((word) => ({ column: 'TITLE', relation: 'STARTS_WITH', condition: word })),
}));

const PAGES = [
  { title: 'Pedido rápido', handle: 'pedido-rapido', templateSuffix: 'pedido-rapido', body: '' },
  { title: 'Contato', handle: 'contact', templateSuffix: 'contact', body: '' },
  { title: 'Dúvidas frequentes', handle: 'faq', templateSuffix: 'faq', body: '' },
];

async function api(query, variables) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const userErrors = (payload) => (payload && payload.userErrors ? payload.userErrors.map((e) => e.message).join('; ') : '');
const say = (mark, text) => console.log(`  ${mark} ${text}`);

async function existingByHandle(field) {
  const found = {};
  let after = null;
  for (;;) {
    const data = await api(
      `query($after: String) { ${field}(first: 100, after: $after) { nodes { id handle title } pageInfo { hasNextPage endCursor } } }`,
      { after }
    );
    data[field].nodes.forEach((node) => (found[node.handle] = node));
    if (!data[field].pageInfo.hasNextPage) return found;
    after = data[field].pageInfo.endCursor;
  }
}

async function setupCollections() {
  console.log('\nColeções');
  const existing = await existingByHandle('collections');
  const ids = {};
  for (const item of [...SPECIAL, ...CATEGORY_COLLECTIONS]) {
    if (existing[item.handle]) {
      ids[item.handle] = existing[item.handle].id;
      say('=', `${item.title} (${item.handle}) já existe — mantida como está`);
      continue;
    }
    if (!APPLY) {
      say('+', `${item.title} (${item.handle}) seria criada com ${item.rules.length} regra(s)`);
      continue;
    }
    const data = await api(
      `mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id handle } userErrors { field message } } }`,
      {
        input: {
          title: item.title,
          handle: item.handle,
          sortOrder: item.sortOrder,
          ruleSet: { appliedDisjunctively: Boolean(item.disjunctive), rules: item.rules },
        },
      }
    );
    const problem = userErrors(data.collectionCreate);
    if (problem) say('!', `${item.title}: ${problem}`);
    else {
      ids[item.handle] = data.collectionCreate.collection.id;
      say('+', `${item.title} criada`);
    }
  }
  return ids;
}

async function setupPages() {
  console.log('\nPáginas');
  const existing = await existingByHandle('pages');
  for (const page of PAGES) {
    if (existing[page.handle]) {
      say('=', `/pages/${page.handle} já existe — mantida`);
      continue;
    }
    if (!APPLY) {
      say('+', `/pages/${page.handle} seria criada com o modelo "${page.templateSuffix}"`);
      continue;
    }
    const data = await api(
      `mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle } userErrors { field message } } }`,
      { page: { title: page.title, handle: page.handle, body: page.body, templateSuffix: page.templateSuffix, isPublished: true } }
    );
    const problem = userErrors(data.pageCreate);
    say(problem ? '!' : '+', problem ? `${page.title}: ${problem}` : `/pages/${page.handle} criada`);
    if (!problem) existing[page.handle] = data.pageCreate.page;
  }
  return existing;
}

async function setupMenus(collectionIds, pageIds) {
  console.log('\nMenus');
  const existing = await existingByHandle('menus');
  const collectionItem = (title, handle) =>
    collectionIds[handle] ? { title, type: 'COLLECTION', resourceId: collectionIds[handle] } : { title, type: 'HTTP', url: `${SITE}/collections/${handle}` };
  const pageItem = (title, handle) =>
    pageIds[handle] ? { title, type: 'PAGE', resourceId: pageIds[handle].id } : { title, type: 'HTTP', url: `${SITE}/pages/${handle}` };

  const menus = [
    {
      title: 'Menu principal',
      handle: 'main-menu',
      items: [
        { title: 'Início', type: 'FRONTPAGE' },
        { title: 'Loja', type: 'CATALOG' },
        { title: 'Categorias', type: 'COLLECTIONS', items: CATEGORY_COLLECTIONS.map((c) => collectionItem(c.title, c.handle)) },
        collectionItem('Novidades', 'novidades'),
        pageItem('Contato', 'contact'),
      ],
    },
    {
      title: 'Institucional',
      handle: 'footer',
      items: [
        { title: 'Loja', type: 'CATALOG' },
        { title: 'Buscar', type: 'SEARCH' },
        pageItem('Dúvidas frequentes', 'faq'),
        pageItem('Contato', 'contact'),
      ],
    },
  ];

  for (const menu of menus) {
    const current = existing[menu.handle];
    // Replacing a menu is the only step that overwrites something: it happens only while the menu still has Shopify's default title, so re-running never undoes later edits
    if (current && !['Main menu', 'Footer menu'].includes(current.title)) {
      say('=', `${menu.handle} já foi personalizado ("${current.title}") — mantido`);
      continue;
    }
    if (!APPLY) {
      say(current ? '~' : '+', `${menu.handle} seria ${current ? 'atualizado' : 'criado'} com ${menu.items.length} itens${menu.handle === 'main-menu' ? ` (Categorias com ${CATEGORY_COLLECTIONS.length} subitens)` : ''}`);
      continue;
    }
    const data = current
      ? await api(
          `mutation($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id } userErrors { field message } } }`,
          { id: current.id, title: menu.title, handle: menu.handle, items: menu.items }
        )
      : await api(
          `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) { menuCreate(title: $title, handle: $handle, items: $items) { menu { id } userErrors { field message } } }`,
          { title: menu.title, handle: menu.handle, items: menu.items }
        );
    const problem = userErrors(data.menuUpdate || data.menuCreate);
    say(problem ? '!' : '+', problem ? `${menu.handle}: ${problem}` : `${menu.handle} ${current ? 'atualizado' : 'criado'}`);
  }
}

(async () => {
  if (!TOKEN) {
    console.error('\n  Defina SHOPIFY_ADMIN_TOKEN (veja o cabeçalho deste arquivo para criar o token).\n');
    process.exit(1);
  }
  console.log(`\n  Loja: ${STORE} — ${APPLY ? 'APLICANDO' : 'simulação (nada será criado; use --apply)'}`);
  let collectionIds = {};
  let pageIds = {};
  if (ONLY.includes('collections')) collectionIds = await setupCollections();
  else collectionIds = Object.fromEntries(Object.entries(await existingByHandle('collections')).map(([h, n]) => [h, n.id]));
  if (ONLY.includes('pages')) pageIds = await setupPages();
  else pageIds = await existingByHandle('pages');
  if (ONLY.includes('menus')) await setupMenus(collectionIds, pageIds);
  console.log('\n  Pronto. Pendências manuais: docs/LANCAMENTO.md\n');
})().catch((error) => {
  console.error(`\n  Erro: ${error.message}\n`);
  process.exit(1);
});
