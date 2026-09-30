/*
 * In-memory stand-in for the Shopify store: builds Liquid-friendly objects
 * (products, collections, cart, search…) from the public catalogue files.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  } catch (error) {
    return fallback;
  }
};

const store_normalizeUpper = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const toCents = (value) => (value == null || value === '' ? null : Math.round(parseFloat(value) * 100));

const normalize = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const handleize = (text) =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function buildImage(image, fallbackAlt) {
  if (!image) return null;
  return {
    id: image.id,
    src: image.src,
    url: image.src,
    alt: image.alt || fallbackAlt || '',
    width: image.width || 1000,
    height: image.height || 1000,
    aspect_ratio: image.width && image.height ? image.width / image.height : 1,
    media_type: 'image',
  };
}

function buildProduct(raw) {
  const images = (raw.images || []).map((image) => buildImage(image, raw.title));
  const media = images.map((image, index) => ({
    id: image.id,
    media_type: 'image',
    alt: image.alt,
    position: index + 1,
    preview_image: image,
    src: image.src,
    width: image.width,
    height: image.height,
    aspect_ratio: image.aspect_ratio,
  }));

  const product = {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    url: `/products/${raw.handle}`,
    description: raw.body_html || '',
    content: raw.body_html || '',
    vendor: raw.vendor,
    type: raw.product_type || '',
    tags: raw.tags || [],
    created_at: raw.created_at,
    published_at: raw.published_at,
    images,
    media,
    featured_image: images[0] || null,
    featured_media: media[0] || null,
    collections: [],
    metafields: {},
    selling_plan_groups: [],
    requires_selling_plan: false,
    object_type: 'product',
  };

  const optionNames = (raw.options || []).map((option) => option.name);
  product.variants = (raw.variants || []).map((variant) => {
    const featured = variant.featured_image ? media.find((item) => item.id === variant.featured_image.id) : null;
    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: toCents(variant.price),
      compare_at_price: toCents(variant.compare_at_price),
      available: Boolean(variant.available),
      requires_shipping: variant.requires_shipping !== false,
      options: [variant.option1, variant.option2, variant.option3].filter((value) => value != null),
      option1: variant.option1,
      option2: variant.option2,
      option3: variant.option3,
      featured_media: featured || null,
      featured_image: featured ? featured.preview_image : null,
      // The public catalogue does not expose stock levels
      inventory_management: null,
      inventory_policy: 'deny',
      inventory_quantity: null,
      quantity_rule: { min: 1, max: null, increment: 1 },
      unit_price_measurement: null,
      url: `/products/${raw.handle}?variant=${variant.id}`,
      product_id: raw.id,
    };
  });

  const prices = product.variants.map((variant) => variant.price);
  const compares = product.variants.map((variant) => variant.compare_at_price).filter((value) => value != null);
  product.price = Math.min(...prices);
  product.price_min = product.price;
  product.price_max = Math.max(...prices);
  product.price_varies = product.price_min !== product.price_max;
  product.compare_at_price = compares.length ? Math.min(...compares) : null;
  product.compare_at_price_min = product.compare_at_price;
  product.compare_at_price_max = compares.length ? Math.max(...compares) : null;
  product.available = product.variants.some((variant) => variant.available);
  product.first_available_variant = product.variants.find((variant) => variant.available) || null;
  product.selected_or_first_available_variant = product.first_available_variant || product.variants[0];
  product.selected_variant = null;
  product.has_only_default_variant =
    product.variants.length === 1 && product.variants[0].title === 'Default Title';
  product.options = optionNames;
  product.options_with_values = (raw.options || []).map((option, index) => ({
    name: option.name,
    position: option.position,
    selected_value: product.selected_or_first_available_variant.options[index],
    values: option.values.map((name) => ({
      id: `${raw.id}-${index}-${handleize(name)}`,
      name,
      available: product.variants.some((variant) => variant.options[index] === name && variant.available),
      selected: product.selected_or_first_available_variant.options[index] === name,
      swatch: null,
      product_url: null,
    })),
  }));

  return product;
}

/* Catalogue
   ========================================================================== */
const shopData = readJson('shop.json', { name: 'New Clean', money_format: 'R$ {{amount_with_comma_separator}}' });
/*
 * PREVIEW_SAMPLE=1 previews the store as it will be after importing the 50-product
 * sample (docs/catalogo/produtos-importacao.csv): only those products, with their
 * tags and demo prices, and the three home collections built from them.
 */
const sampleDefinition = process.env.PREVIEW_SAMPLE ? readJson('sample.json', null) : null;
let rawProducts = readJson('products.json', []);
if (sampleDefinition) {
  const byHandle = new Map(sampleDefinition.products.map((item) => [item.handle, item]));
  rawProducts = rawProducts
    .filter((raw) => byHandle.has(raw.handle))
    .map((raw) => {
      const item = byHandle.get(raw.handle);
      const variants = raw.variants.map((variant, index) => (index === 0 ? { ...variant, compare_at_price: item.compare_at_price } : variant));
      return { ...raw, tags: item.tags, variants };
    });
}
const products = rawProducts.map(buildProduct);
/*
 * The live catalogue has a single photo per product. To preview the
 * second-image hover effect, borrow a photo from a neighbouring product:
 *   PREVIEW_DEMO_SECOND_IMAGE=1 npm run preview
 */
if (process.env.PREVIEW_DEMO_SECOND_IMAGE) {
  const withImage = products.filter((product) => product.images.length === 1);
  withImage.forEach((product, index) => {
    const donor = withImage[(index + 1) % withImage.length];
    if (!donor || donor === product) return;
    const image = { ...donor.images[0], id: `${donor.images[0].id}-demo`, alt: `${product.title} (foto de demonstração)` };
    product.images.push(image);
    product.media.push({ ...donor.media[0], id: image.id, preview_image: image, position: 2 });
  });
}

/*
 * Volume pricing needs Shopify B2B catalogues. To preview the block:
 *   PREVIEW_DEMO_B2B=1 npm run preview
 */
if (process.env.PREVIEW_DEMO_B2B) {
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.quantity_price_breaks = [
        { minimum_quantity: 6, price: Math.round(variant.price * 0.95) },
        { minimum_quantity: 12, price: Math.round(variant.price * 0.9) },
      ];
    });
  });
}

const productsByHandle = new Map(products.map((product) => [product.handle, product]));
const productsById = new Map(products.map((product) => [String(product.id), product]));
const variantsById = new Map();
products.forEach((product) => product.variants.forEach((variant) => variantsById.set(String(variant.id), { product, variant })));

const SORT_OPTIONS = [
  { value: 'manual', name: 'Em destaque' },
  { value: 'best-selling', name: 'Mais vendidos' },
  { value: 'title-ascending', name: 'Ordem alfabética, A–Z' },
  { value: 'title-descending', name: 'Ordem alfabética, Z–A' },
  { value: 'price-ascending', name: 'Preço, ordem crescente' },
  { value: 'price-descending', name: 'Preço, ordem decrescente' },
  { value: 'created-descending', name: 'Data, mais recente primeiro' },
  { value: 'created-ascending', name: 'Data, mais antiga primeiro' },
];

const baseCollections = [
  {
    id: 1,
    handle: 'all',
    title: 'Loja',
    description: '',
    image: null,
    products,
    default_sort_by: 'title-ascending',
  },
];

(sampleDefinition ? [] : readJson('collections.json', [])).forEach((raw) => {
  const ids = new Set((raw.product_ids || []).map(String));
  const items = products.filter((product) => ids.has(String(product.id)));
  const collection = {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description || '',
    image: buildImage(raw.image, raw.title),
    products: items,
    default_sort_by: 'manual',
  };
  items.forEach((product) => product.collections.push(collection));
  baseCollections.push(collection);
});

if (sampleDefinition) {
  sampleDefinition.collections.forEach((definition, index) => {
    const items = products.filter((product) =>
      definition.rule.tag ? product.tags.includes(definition.rule.tag) : product.compare_at_price > product.price
    );
    const collection = { id: 300 + index, handle: definition.handle, title: definition.title, description: '', image: null, products: items, default_sort_by: 'manual' };
    items.forEach((product) => product.collections.push(collection));
    baseCollections.push(collection);
  });
}

/*
 * "Ofertas": the real catalogue has no product with a discount (compare-at
 * equals the price), so the preview marks a few staple products down by about
 * 20-30% to show the promotion block. Disable with PREVIEW_NO_PROMO=1.
 */
if (!process.env.PREVIEW_NO_PROMO && !baseCollections.some((collection) => collection.handle === 'ofertas')) {
  const wanted = ['DESINFETANTE', 'TOA DE PAPEL', 'SACO LIXO', 'ALCOOL', 'MULTIUSO', 'VASSOURA', 'PAPEL HIG', 'DETERGENTE'];
  const promoted = [];
  wanted.forEach((prefix) => {
    const matches = products.filter((product) => product.available && product.featured_image && product.featured_image.width >= 700 && store_normalizeUpper(product.title).startsWith(prefix) && product.price >= 500 && product.price <= 9000 && !promoted.includes(product));
    const match = matches[matches.length > 2 ? 2 : 0];
    if (match) promoted.push(match);
  });
  promoted.forEach((product, index) => {
    const markup = [1.25, 1.3, 1.2, 1.28, 1.22, 1.35, 1.25, 1.3][index % 8];
    const compare = Math.round(product.price * markup);
    product.compare_at_price = compare;
    product.compare_at_price_min = compare;
    product.compare_at_price_max = compare;
    product.variants.forEach((variant) => {
      variant.compare_at_price = Math.round(variant.price * markup);
    });
  });
  baseCollections.push({ id: 3, handle: 'ofertas', title: 'Ofertas', description: '', image: null, products: promoted, default_sort_by: 'manual' });
}

/*
 * "Mais vendidos": on the real store this is an automated collection sorted by
 * best selling. The public catalogue has no sales data, so the preview fakes
 * it with staple items that have a photo and are in stock.
 */
if (!process.env.PREVIEW_NO_BESTSELLERS && !baseCollections.some((collection) => collection.handle === 'mais-vendidos')) {
  const staples = ['DESINFETANTE', 'PAPEL HIG', 'SACO LIXO', 'DETERGENTE', 'ALCOOL', 'AGUA SANITARIA', 'LIMPADOR', 'SABONETE', 'TOA DE PAPEL', 'MULTIUSO'];
  const picked = [];
  staples.forEach((prefix) => {
    const match = products.find((product) => product.available && product.featured_image && store_normalizeUpper(product.title).startsWith(prefix) && !picked.includes(product));
    if (match) picked.push(match);
  });
  baseCollections.push({ id: 2, handle: 'mais-vendidos', title: 'Mais vendidos', description: '', image: null, products: picked, default_sort_by: 'manual' });
}

/*
 * PREVIEW_DEMO_CATEGORIES=1 simulates the automatic collections suggested in
 * docs/colecoes.md, to test the "all categories" page with many collections.
 */
if (process.env.PREVIEW_DEMO_CATEGORIES) {
  const groups = require('./category-groups');
  Object.entries(groups).forEach(([title, words], index) => {
    const items = products.filter((product) => {
      const name = store_normalizeUpper(product.title);
      return words.some((word) => name.startsWith(`${word} `) || name.startsWith(`${word}S `) || name === word);
    });
    const handle = require('./slug')(title);
    const collection = { id: 100 + index, handle, title, description: '', image: null, products: items, default_sort_by: 'manual' };
    items.forEach((product) => product.collections.push(collection));
    baseCollections.push(collection);
  });
}

baseCollections.forEach((collection) => {
  collection.url = `/collections/${collection.handle}`;
  collection.products_count = collection.products.length;
  collection.all_products_count = collection.products.length;
  collection.all_vendors = Array.from(new Set(collection.products.map((product) => product.vendor)));
  collection.sort_options = SORT_OPTIONS;
  collection.sort_by = '';
  collection.filters = [];
  collection.featured_image = collection.image || (collection.products.find((p) => p.featured_image) || {}).featured_image || null;
});

function sortProducts(list, sortBy) {
  const sorted = list.slice();
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'pt-BR');
  switch (sortBy) {
    case 'title-ascending':
      return sorted.sort(byTitle);
    case 'title-descending':
      return sorted.sort((a, b) => byTitle(b, a));
    case 'price-ascending':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-descending':
      return sorted.sort((a, b) => b.price - a.price);
    case 'created-descending':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'created-ascending':
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    default:
      return sorted;
  }
}

/* Storefront filtering (availability + price), enough to exercise the UI */
function buildFilters(list, query, pathname) {
  const urlWithout = (names) => {
    const params = new URLSearchParams();
    query.forEach((value, key) => {
      if (!names.some((name) => (typeof name === 'string' ? key === name : key === name[0] && value === name[1]))) {
        if (key !== 'page' && key !== 'section_id') params.append(key, value);
      }
    });
    const text = params.toString();
    return text ? `${pathname}?${text}` : pathname;
  };
  const urlWith = (key, value) => {
    const params = new URLSearchParams();
    query.forEach((v, k) => {
      if (k !== 'page' && k !== 'section_id') params.append(k, v);
    });
    params.append(key, value);
    return `${pathname}?${params}`;
  };

  const availability = query.getAll('filter.v.availability');
  const gte = query.get('filter.v.price.gte');
  const lte = query.get('filter.v.price.lte');
  const min = gte ? Math.round(parseFloat(gte.replace(',', '.')) * 100) : null;
  const max = lte ? Math.round(parseFloat(lte.replace(',', '.')) * 100) : null;

  const matchesPrice = (product) => (min == null || product.price >= min) && (max == null || product.price <= max);
  const matchesAvailability = (product) =>
    !availability.length || availability.includes(product.available ? '1' : '0');

  const result = list.filter((product) => matchesPrice(product) && matchesAvailability(product));
  const priceScoped = list.filter(matchesPrice);

  const availabilityValues = [
    { label: 'Em estoque', value: '1' },
    { label: 'Fora de estoque', value: '0' },
  ].map((item) => ({
    ...item,
    param_name: 'filter.v.availability',
    count: priceScoped.filter((product) => (product.available ? '1' : '0') === item.value).length,
    active: availability.includes(item.value),
    swatch: null,
    url_to_add: urlWith('filter.v.availability', item.value),
    url_to_remove: urlWithout([['filter.v.availability', item.value]]),
  }));

  const filters = [
    {
      label: 'Disponibilidade',
      type: 'list',
      presentation: 'text',
      param_name: 'filter.v.availability',
      values: availabilityValues,
      active_values: availabilityValues.filter((value) => value.active),
      url_to_remove: urlWithout(['filter.v.availability']),
    },
    {
      label: 'Preço',
      type: 'price_range',
      param_name: 'filter.v.price',
      values: [],
      active_values: [],
      min_value: { param_name: 'filter.v.price.gte', value: min },
      max_value: { param_name: 'filter.v.price.lte', value: max },
      range_max: list.reduce((highest, product) => Math.max(highest, product.price), 0),
      url_to_remove: urlWithout(['filter.v.price.gte', 'filter.v.price.lte']),
    },
  ];

  return { products: result, filters };
}

function getCollection(handle, query = new URLSearchParams()) {
  const base = baseCollections.find((collection) => collection.handle === handle);
  if (!base) return null;
  const pathname = base.url;
  const sortBy = query.get('sort_by') || '';
  const { products: filtered, filters } = buildFilters(base.products, query, pathname);
  return {
    ...base,
    sort_by: sortBy,
    filters,
    products: sortProducts(filtered, sortBy || base.default_sort_by),
    products_count: filtered.length,
  };
}

/* `collections` is both iterable and addressable by handle, like in Shopify */
function collectionsDrop() {
  const list = baseCollections.filter((collection) => collection.handle !== 'all').slice();
  baseCollections.forEach((collection) => {
    Object.defineProperty(list, collection.handle, { value: collection, enumerable: false });
  });
  return list;
}

/* Search
   ========================================================================== */
function searchProducts(terms) {
  const text = String(terms || '').trim();
  if (!text) return [];

  // `id:123 OR id:456` is used by the recently viewed section
  const ids = text.match(/id:\s*"?(\d+)"?/g);
  if (ids) {
    return ids
      .map((token) => productsById.get(token.replace(/\D/g, '')))
      .filter(Boolean);
  }

  const words = normalize(text).split(/\s+/).filter(Boolean);
  const scored = [];
  products.forEach((product) => {
    const title = normalize(product.title);
    const titleWords = title.split(/[^a-z0-9]+/);
    const sku = normalize(product.variants[0] && product.variants[0].sku);
    let score = 0;
    const matches = words.every((word) => {
      if (titleWords.some((item) => item.startsWith(word))) {
        score += titleWords[0].startsWith(word) ? 3 : 2;
        return true;
      }
      if (title.includes(word) || sku === word) {
        score += 1;
        return true;
      }
      return false;
    });
    if (matches) scored.push({ product, score: score + (product.available ? 0.5 : 0) });
  });
  return scored.sort((a, b) => b.score - a.score).map((item) => item.product);
}

function relatedProducts(productId, limit, intent) {
  const product = productsById.get(String(productId));
  if (!product) return [];
  const words = normalize(product.title).split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const pool = products.filter((item) => item.id !== product.id && item.available);
  const sameFamily = pool.filter((item) => normalize(item.title).startsWith(words[0] || '\u0000'));

  if (intent === 'complementary') {
    // Shopify returns what the merchant picked in Search & Discovery; here we
    // simulate it with products from other families.
    const others = pool.filter((item) => !sameFamily.includes(item) && item.featured_image);
    const start = Number(String(product.id).slice(-3)) % Math.max(1, others.length - limit);
    return others.slice(start, start + limit);
  }

  const result = sameFamily.slice(0, limit);
  if (result.length < limit) {
    const start = Number(String(product.id).slice(-3)) % Math.max(1, pool.length - limit);
    pool.slice(start, start + limit * 2).forEach((item) => {
      if (result.length < limit && !result.includes(item)) result.push(item);
    });
  }
  return result;
}

/* Cart
   ========================================================================== */
const carts = new Map();

function getCartState(sessionId) {
  if (!carts.has(sessionId)) carts.set(sessionId, { lines: [], note: '', attributes: {} });
  return carts.get(sessionId);
}

function buildCart(state) {
  const items = state.lines
    .map((line, index) => {
      const entry = variantsById.get(String(line.variant_id));
      if (!entry) return null;
      const { product, variant } = entry;
      const linePrice = variant.price * line.quantity;
      return {
        key: line.key,
        id: variant.id,
        index: index + 1,
        variant_id: variant.id,
        product_id: product.id,
        quantity: line.quantity,
        title: product.has_only_default_variant ? product.title : `${product.title} - ${variant.title}`,
        product_title: product.title,
        variant_title: product.has_only_default_variant ? null : variant.title,
        product,
        variant,
        sku: variant.sku,
        vendor: product.vendor,
        url: variant.url,
        image: variant.featured_image || product.featured_image,
        options_with_values: product.has_only_default_variant
          ? []
          : product.options.map((name, position) => ({ name, value: variant.options[position] })),
        properties: Object.entries(line.properties || {}),
        price: variant.price,
        final_price: variant.price,
        original_price: variant.price,
        line_price: linePrice,
        final_line_price: linePrice,
        original_line_price: linePrice,
        total_discount: 0,
        line_level_discount_allocations: [],
        discount_allocations: [],
        selling_plan_allocation: null,
        requires_shipping: variant.requires_shipping,
        gift_card: false,
      };
    })
    .filter(Boolean);

  const total = items.reduce((sum, item) => sum + item.final_line_price, 0);
  return {
    token: 'local-preview',
    note: state.note,
    attributes: state.attributes || {},
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    total_price: total,
    original_total_price: total,
    items_subtotal_price: total,
    total_discount: 0,
    total_weight: 0,
    requires_shipping: items.some((item) => item.requires_shipping),
    currency: { iso_code: 'BRL', symbol: 'R$', name: 'Real brasileiro' },
    cart_level_discount_applications: [],
    discount_applications: [],
    taxes_included: true,
    empty: items.length === 0,
  };
}

/* JSON shape returned by the Ajax cart API (no circular references) */
function cartJson(cart) {
  return {
    token: cart.token,
    note: cart.note,
    attributes: cart.attributes,
    item_count: cart.item_count,
    total_price: cart.total_price,
    original_total_price: cart.original_total_price,
    items_subtotal_price: cart.items_subtotal_price,
    total_discount: 0,
    requires_shipping: cart.requires_shipping,
    currency: 'BRL',
    items: cart.items.map(lineJson),
  };
}

function lineJson(item) {
  return {
    id: item.variant_id,
    key: item.key,
    variant_id: item.variant_id,
    product_id: item.product_id,
    quantity: item.quantity,
    title: item.title,
    product_title: item.product_title,
    variant_title: item.variant_title,
    price: item.price,
    final_price: item.final_price,
    line_price: item.line_price,
    final_line_price: item.final_line_price,
    sku: item.sku,
    url: item.url,
    handle: item.product.handle,
    image: item.image ? item.image.src : null,
    properties: Object.fromEntries(item.properties),
  };
}

function cartAdd(state, entries) {
  const added = [];
  entries.forEach((entry) => {
    const id = String(entry.id);
    const found = variantsById.get(id);
    if (!found) {
      const error = new Error('Produto não encontrado.');
      error.status = 404;
      throw error;
    }
    if (!found.variant.available) {
      const error = new Error(`O produto "${found.product.title}" está esgotado.`);
      error.status = 422;
      throw error;
    }
    const quantity = Math.max(1, parseInt(entry.quantity, 10) || 1);
    const properties = entry.properties || {};
    const key = `${id}:${Buffer.from(JSON.stringify(properties)).toString('hex').slice(0, 16) || 'default'}`;
    const existing = state.lines.find((line) => line.key === key);
    if (existing) existing.quantity += quantity;
    else state.lines.unshift({ key, variant_id: id, quantity, properties });
    added.push(key);
  });
  return added;
}

function cartChange(state, { id, line, quantity }) {
  const amount = Math.max(0, parseInt(quantity, 10) || 0);
  let target = null;
  if (line) target = state.lines[parseInt(line, 10) - 1];
  else target = state.lines.find((item) => item.key === String(id) || item.variant_id === String(id));
  if (!target) {
    const error = new Error('Item não encontrado no carrinho.');
    error.status = 404;
    throw error;
  }
  if (amount === 0) state.lines.splice(state.lines.indexOf(target), 1);
  else target.quantity = amount;
}

/* Demo customer for the local preview (/account/login)
   ========================================================================== */
const DEMO_CREDENTIALS = { email: 'cliente@newclean.test', password: 'newclean123' };

function buildCustomer() {
  const address = (id, overrides = {}) => ({
    id,
    url: `/account/addresses/${id}`,
    first_name: 'Cliente',
    last_name: 'Demonstração',
    name: 'Cliente Demonstração',
    company: 'Condomínio Exemplo',
    address1: 'Av. Exemplo, 123',
    address2: 'Sala 4',
    street: 'Av. Exemplo, 123, Sala 4',
    city: 'Vila Velha',
    province: 'Espírito Santo',
    province_code: 'ES',
    country: 'Brazil',
    country_code: 'BR',
    zip: '29100-000',
    phone: '(27) 99291-8283',
    summary: 'Av. Exemplo, 123, Vila Velha, ES',
    ...overrides,
  });

  const pool = products.filter((product) => product.available && product.featured_image);
  const pick = (offset, count) => pool.slice(offset, offset + count);
  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

  const makeOrder = (number, daysBack, items, status) => {
    const lineItems = items.map(([product, quantity], index) => {
      const variant = product.variants[0];
      return {
        id: number * 10 + index,
        title: product.title,
        product,
        variant,
        variant_id: variant.id,
        product_id: product.id,
        sku: variant.sku,
        vendor: product.vendor,
        quantity,
        url: product.url,
        image: product.featured_image,
        final_price: variant.price,
        original_price: variant.price,
        final_line_price: variant.price * quantity,
        original_line_price: variant.price * quantity,
        line_level_discount_allocations: [],
        properties: [],
        selling_plan_allocation: null,
        gift_card: false,
        requires_shipping: true,
        fulfillment:
          status.fulfillment === 'fulfilled'
            ? { tracking_company: 'Correios', tracking_number: `NC${number}00BR`, tracking_url: 'https://rastreamento.correios.com.br/', created_at: daysAgo(daysBack - 1) }
            : null,
      };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.final_line_price, 0);
    const shipping = subtotal >= 15000 ? 0 : 1990;
    return {
      id: number,
      name: `#${number}`,
      order_number: number,
      customer_url: `/account/orders/${number}`,
      order_status_url: `/account/orders/${number}`,
      created_at: daysAgo(daysBack),
      email: DEMO_CREDENTIALS.email,
      phone: '(27) 99291-8283',
      financial_status: status.financial,
      financial_status_label: status.financialLabel,
      fulfillment_status: status.fulfillment,
      fulfillment_status_label: status.fulfillmentLabel,
      cancelled: false,
      cancelled_at: null,
      cancel_reason_label: null,
      line_items: lineItems,
      item_count: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      line_items_subtotal_price: subtotal,
      subtotal_price: subtotal,
      shipping_price: shipping,
      shipping_methods: [{ title: shipping === 0 ? 'Frete grátis' : 'Entrega New Clean', price: shipping }],
      tax_lines: [],
      tax_price: 0,
      total_discounts: 0,
      total_duties: null,
      total_price: subtotal + shipping,
      total_net_amount: subtotal + shipping,
      total_refunded_amount: 0,
      cart_level_discount_applications: [],
      discount_applications: [],
      shipping_address: address(1),
      billing_address: address(1),
      note: '',
      tags: [],
      attributes: { 'Forma de pagamento': 'pix' },
      transactions: [],
    };
  };

  const orders = [
    makeOrder(1003, 2, pick(0, 3).map((p, i) => [p, i + 1]), { financial: 'paid', financialLabel: 'Pago', fulfillment: 'unfulfilled', fulfillmentLabel: 'Em separação' }),
    makeOrder(1002, 12, pick(3, 2).map((p) => [p, 6]), { financial: 'paid', financialLabel: 'Pago', fulfillment: 'fulfilled', fulfillmentLabel: 'Enviado' }),
    makeOrder(1001, 40, pick(5, 4).map((p, i) => [p, i % 2 ? 2 : 12]), { financial: 'paid', financialLabel: 'Pago', fulfillment: 'fulfilled', fulfillmentLabel: 'Entregue' }),
  ];

  const addresses = [address(1), address(2, { company: '', address1: 'Rua das Flores, 45', address2: '', street: 'Rua das Flores, 45', city: 'Vitória', zip: '29000-000', summary: 'Rua das Flores, 45, Vitória, ES' })];

  return {
    id: 1,
    first_name: 'Cliente',
    last_name: 'Demonstração',
    name: 'Cliente Demonstração',
    email: DEMO_CREDENTIALS.email,
    phone: '(27) 99291-8283',
    accepts_marketing: true,
    has_account: true,
    tags: ['demo'],
    orders,
    orders_count: orders.length,
    total_spent: orders.reduce((sum, order) => sum + order.total_price, 0),
    addresses,
    addresses_count: addresses.length,
    default_address: addresses[0],
    new_address: address('new', { first_name: '', last_name: '', company: '', address1: '', address2: '', city: '', province: '', province_code: '', zip: '', phone: '', summary: '' }),
    b2b: false,
    company_available_locations: [],
  };
}

module.exports = {
  shopData,
  products,
  productsByHandle,
  productsById,
  baseCollections,
  getCollection,
  collectionsDrop,
  searchProducts,
  relatedProducts,
  sortProducts,
  buildFilters,
  getCartState,
  buildCart,
  cartJson,
  lineJson,
  cartAdd,
  cartChange,
  handleize,
  normalize,
  DEMO_CREDENTIALS,
  buildCustomer,
  SORT_OPTIONS,
};
