/*
 * Turns the local catalogue (dev/data/products.json, taken from the public
 * storefront) into a Shopify product CSV, ready for Admin > Produtos > Importar.
 * Used to fill a TEST store with the same products; it never talks to Shopify.
 *
 * - Photos are sent as image URLs (Shopify downloads them on import).
 * - The public catalogue has no stock counts, only "available": available
 *   products are left without inventory tracking (always purchasable), sold-out
 *   ones get tracking with quantity 0.
 * - compare-at equal to the price is dropped (it is not a real promotion).
 *
 * By default it exports a sample of 50 products, enough to see every part of
 * the theme working: products the home page references, about 3 per category
 * (with photo, in stock) and 3 sold-out ones. Use --all for the whole
 * catalogue or --limit=N for another size.
 *
 * Usage: node dev/export-shopify-csv.js [output.csv] [--all | --limit=N]
 */
const fs = require('fs');
const path = require('path');

const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8'));
const args = process.argv.slice(2);
const output = args.find((arg) => !arg.startsWith('--')) || path.join(__dirname, '..', 'docs', 'catalogo', 'produtos-importacao.csv');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = args.includes('--all') ? Infinity : limitArg ? Number(limitArg.slice(8)) : 50;

const groups = require('./lib/category-groups');
const root = path.join(__dirname, '..');
const readTheme = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const hasPhoto = (product) => (product.images || []).length > 0;
const inStock = (product) => product.variants[0].available;
const words = (text) => normalize(text).split(/[^A-Z0-9]+/).filter(Boolean);
// Shopify-like search: every typed word must start some word of the title
const matchesTerm = (product, term) => {
  const titleWords = words(product.title);
  return words(term).every((word) => titleWords.some((item) => item.startsWith(word)));
};

/* What the home page links to, so that no link lands on an empty page:
   product handles, category searches, brands and the popular searches. */
function homeReferences() {
  const index = JSON.parse(readTheme('templates/index.json'));
  const handles = new Set();
  const terms = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    Object.entries(node).forEach(([key, value]) => {
      if (key === 'showcase_products' && Array.isArray(value)) value.forEach((handle) => handles.add(handle));
      else if (key === 'link' && typeof value === 'string' && value.includes('/search?')) terms.add(new URL(value, 'https://x').searchParams.get('q'));
      else if (key === 'name' && typeof value === 'string' && node.logo === undefined && Object.keys(node).length <= 3) terms.add(value);
      else walk(value);
    });
  };
  walk(index);
  const schema = JSON.parse(readTheme('config/settings_schema.json'));
  schema.forEach((group) => (group.settings || []).forEach((setting) => {
    if (setting.id === 'search_popular_terms') setting.default.split('\n').forEach((term) => terms.add(term.split('|').pop()));
  }));
  return { handles: Array.from(handles), terms: Array.from(terms).filter(Boolean) };
}

function sample(size) {
  const references = homeReferences();
  const picked = new Map();
  const room = (reserve = 0) => picked.size < size - reserve;
  const add = (product, reserve = 0) => product && room(reserve) && picked.set(product.handle, product);
  const usable = catalogue.filter((product) => hasPhoto(product) && inStock(product));

  references.handles.forEach((handle) => add(catalogue.find((product) => product.handle === handle), 3));
  // Every search the home page offers (categories, brands, popular terms) must find something
  references.terms.forEach((term) => {
    if (!Array.from(picked.values()).some((product) => matchesTerm(product, term))) add(usable.find((product) => matchesTerm(product, term)), 3);
  });
  // Then spread the rest over the categories
  const perGroup = Object.values(groups).map((list) =>
    usable.filter((product) => list.some((word) => {
      const name = normalize(product.title);
      return name.startsWith(`${word} `) || name.startsWith(`${word}S `) || name === word;
    }))
  );
  for (let round = 0; round < 3; round += 1) {
    perGroup.forEach((list) => {
      const step = Math.max(1, Math.floor(list.length / 3));
      add(list[round * step], 3);
    });
  }
  // A few sold-out products, to see the "Esgotado" state
  catalogue.filter((product) => hasPhoto(product) && !inStock(product)).slice(0, 3).forEach((product) => add(product));
  return Array.from(picked.values());
}

const isSample = limit < catalogue.length;
let products = isSample ? sample(limit) : catalogue;

/* Demo merchandising for a test store: tags that feed the home collections and a
   few discounted prices, so "Mais vendidos", "Novidades" and "Em promoção agora"
   have something to show. These prices are NOT the real ones. */
const collectionsDefinition = [
  { handle: 'mais-vendidos', title: 'Mais vendidos', rule: { tag: 'mais-vendidos' } },
  { handle: 'novidades', title: 'Novidades', rule: { tag: 'novidades' } },
  { handle: 'ofertas', title: 'Ofertas', rule: { reduced: true } },
];
if (isSample) {
  const available = products.filter(inStock);
  const bestsellers = new Set(available.slice(0, 8).map((product) => product.handle));
  const fresh = new Set(available.slice(8, 16).map((product) => product.handle));
  const promoted = available.filter((product, index) => index % 7 === 3).slice(0, 5).map((product) => product.handle);
  const markups = [1.25, 1.3, 1.2, 1.28, 1.22];
  products = products.map((product) => {
    const tags = [];
    if (bestsellers.has(product.handle)) tags.push('mais-vendidos');
    if (fresh.has(product.handle)) tags.push('novidades');
    const promoIndex = promoted.indexOf(product.handle);
    const variant = { ...product.variants[0] };
    if (promoIndex >= 0) {
      variant.compare_at_price = (Number(variant.price) * markups[promoIndex]).toFixed(2);
      tags.push('oferta-demo');
    }
    return { ...product, tags, variants: [variant] };
  });
  fs.writeFileSync(
    path.join(__dirname, 'data', 'sample.json'),
    JSON.stringify({ products: products.map((product) => ({ handle: product.handle, tags: product.tags, compare_at_price: product.variants[0].compare_at_price || null })), collections: collectionsDefinition }, null, 2)
  );
}

const columns = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker',
  'Variant Inventory Qty', 'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price',
  'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position',
  'Image Alt Text', 'Gift Card', 'Status',
];

const escape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rows = [columns.map(escape).join(',')];
let withImage = 0;
let soldOut = 0;

products.forEach((product) => {
  const variant = product.variants[0];
  const image = (product.images || [])[0];
  if (image) withImage += 1;
  if (!variant.available) soldOut += 1;
  const compare = variant.compare_at_price && Number(variant.compare_at_price) > Number(variant.price) ? variant.compare_at_price : '';

  const row = {
    Handle: product.handle,
    Title: product.title,
    'Body (HTML)': product.body_html || '',
    Vendor: product.vendor,
    'Product Category': '',
    Type: product.product_type || '',
    Tags: (product.tags || []).join(', '),
    Published: 'true',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': variant.sku || '',
    'Variant Grams': variant.grams || 0,
    'Variant Inventory Tracker': variant.available ? '' : 'shopify',
    'Variant Inventory Qty': variant.available ? '' : 0,
    'Variant Inventory Policy': 'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price': variant.price,
    'Variant Compare At Price': compare,
    'Variant Requires Shipping': 'true',
    'Variant Taxable': 'true',
    'Image Src': image ? image.src : '',
    'Image Position': image ? 1 : '',
    'Image Alt Text': image ? product.title : '',
    'Gift Card': 'false',
    Status: 'active',
  };
  rows.push(columns.map((column) => escape(row[column])).join(','));
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `﻿${rows.join('\r\n')}\r\n`);
const size = (fs.statSync(output).size / 1024).toFixed(0);
console.log(`\n  ${products.length} produtos · ${withImage} com foto · ${soldOut} esgotados · ${size} KB\n  ${path.relative(process.cwd(), output)}\n`);
