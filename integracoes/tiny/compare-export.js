/*
 * Compares a Tiny products export (CSV) with what is live in Shopify, read-only:
 * stale prices, stock differences, products in the Tiny that are not in the store.
 *
 *   1. Tiny > Cadastros > Produtos > Exportar (planilha CSV, com código, preço e estoque)
 *   2. node integracoes/tiny/compare-export.js caminho/do/export.csv
 *
 * Shopify is read through the authorized Shopify CLI (`shopify store execute`).
 * For offline tests: --shopify-json=arquivo.json  (same shape as productVariants nodes).
 * Writes nothing to Tiny or to Shopify.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const jsonArg = args.find((arg) => arg.startsWith('--shopify-json='));
const STORE = process.env.SHOPIFY_STORE || 'dfd10g-i2.myshopify.com';
if (!file) {
  console.error('\n  Uso: node integracoes/tiny/compare-export.js export-do-tiny.csv\n');
  process.exit(1);
}

const { loadTinyExport } = require('./lib/export-csv');

const { products: tiny, columns: col, header } = loadTinyExport(file);
console.log('\n  Colunas reconhecidas:', Object.entries(col).map(([key, index]) => `${key}=${index >= 0 ? header[index] : '—'}`).join(' · '));

function shopifyVariants() {
  if (jsonArg) return JSON.parse(fs.readFileSync(jsonArg.slice(15), 'utf8'));
  const nodes = [];
  let after = null;
  for (;;) {
    const query = `query($after: String) { productVariants(first: 250, after: $after) { nodes { sku price compareAtPrice inventoryQuantity product { title status } } pageInfo { hasNextPage endCursor } } }`;
    const run = spawnSync('npx', ['--no-install', 'shopify', 'store', 'execute', '--store', STORE, '--json', '--query', query, '--variables', JSON.stringify({ after })], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, cwd: path.join(__dirname, '..', '..') });
    if (run.status !== 0) throw new Error(`shopify store execute falhou: ${(run.stderr || run.stdout).slice(0, 300)}`);
    const data = JSON.parse(run.stdout.slice(run.stdout.indexOf('{\n')));
    nodes.push(...data.productVariants.nodes);
    if (!data.productVariants.pageInfo.hasNextPage) break;
    after = data.productVariants.pageInfo.endCursor;
  }
  return nodes;
}

const shop = new Map();
shopifyVariants().forEach((variant) => variant.sku && shop.set(String(variant.sku).trim(), variant));

const priceDiffs = [];
const stockDiffs = [];
const onlyTiny = [];
let matched = 0;
tiny.forEach((item) => {
  const variant = shop.get(item.sku);
  if (!variant) {
    if (item.active) onlyTiny.push(item);
    return;
  }
  matched += 1;
  const expected = item.promo && item.promo > 0 && item.promo < item.price ? item.promo : item.price;
  const live = Number(variant.price);
  if (expected !== null && Math.abs(expected - live) > 0.005) priceDiffs.push({ sku: item.sku, title: item.title || variant.product.title, tiny: expected, shopify: live, promo: item.promo });
  if (item.stock !== null && Math.max(0, Math.floor(item.stock)) !== variant.inventoryQuantity) stockDiffs.push({ sku: item.sku, title: item.title || variant.product.title, tiny: item.stock, shopify: variant.inventoryQuantity });
});
const onlyShop = [...shop.keys()].filter((sku) => !tiny.has(sku));

const money = (value) => (value === null ? '—' : `R$ ${value.toFixed(2).replace('.', ',')}`);
console.log(`\n  Tiny: ${tiny.size} produtos com código · Shopify: ${shop.size} variantes com SKU · casaram: ${matched}\n`);
console.log(`  Preço diferente:  ${priceDiffs.length}`);
console.log(`  Estoque diferente: ${stockDiffs.length}`);
console.log(`  Ativos no Tiny e fora da Shopify: ${onlyTiny.length}`);
console.log(`  Na Shopify e fora do Tiny: ${onlyShop.length}`);
const sorted = priceDiffs.slice().sort((a, b) => Math.abs(b.tiny - b.shopify) / b.shopify - Math.abs(a.tiny - a.shopify) / a.shopify);
if (sorted.length) {
  console.log('\n  Maiores diferenças de preço (Tiny → Shopify):');
  sorted.slice(0, 15).forEach((d) => console.log(`    ${d.sku.padEnd(16)} ${d.title.slice(0, 42).padEnd(42)} ${money(d.tiny)} → ${money(d.shopify)}`));
}
const withPromo = [...tiny.values()].filter((item) => item.promo && item.promo > 0).length;
console.log(`\n  Produtos com preço promocional no Tiny: ${withPromo}`);

fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const out = path.join(__dirname, 'out', `comparacao-${new Date().toISOString().slice(0, 10)}.csv`);
const lines = ['tipo;sku;produto;tiny;shopify'];
priceDiffs.forEach((d) => lines.push(`preco;${d.sku};"${d.title}";${d.tiny};${d.shopify}`));
stockDiffs.forEach((d) => lines.push(`estoque;${d.sku};"${d.title}";${d.tiny};${d.shopify}`));
onlyTiny.forEach((d) => lines.push(`so_tiny;${d.sku};"${d.title}";${d.price ?? ''};`));
onlyShop.forEach((sku) => lines.push(`so_shopify;${sku};"${shop.get(sku).product.title}";;${shop.get(sku).price}`));
fs.writeFileSync(out, `﻿${lines.join('\n')}\n`);
console.log(`\n  Relatório completo: ${path.relative(process.cwd(), out)}\n`);
