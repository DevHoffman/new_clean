/*
 * Aligns Shopify prices with a Tiny products export (CSV). The Tiny does not push
 * price changes to Shopify by itself (only stock), so this closes that gap.
 *
 * Safe by default: without --apply it only lists what would change.
 *   - matches by SKU and SKIPS any product whose title does not look the same
 *     (a short SKU can belong to different products in the Tiny and in Shopify)
 *   - only products active in the Tiny, with a price above zero
 *   - "Comparar a" is cleared: the Tiny does not send one, and an old compare-at
 *     above a new, lower price would show a false promotion
 *   - every change is written to out/rollback-prices-<date>.json and can be undone
 *
 *   node integracoes/tiny/apply-prices-from-export.js export.csv --only=cheaper
 *   node integracoes/tiny/apply-prices-from-export.js export.csv --only=cheaper --apply
 *   node integracoes/tiny/apply-prices-from-export.js --rollback=out/rollback-prices-….json [--apply]
 *
 * --only=cheaper  prices where Shopify is BELOW the Tiny (raises prices)
 * --only=higher   prices where Shopify is ABOVE the Tiny (lowers prices)
 * --only=all      both
 * --promo         a Tiny promotional price below the price becomes price + "Comparar a"
 */
const fs = require('fs');
const path = require('path');
const { loadTinyExport, titleSimilarity } = require('./lib/export-csv');
const shop = require('./lib/shopify-cli');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => (args.find((arg) => arg.startsWith(`--${name}=`)) || '').slice(name.length + 3) || null;
const file = args.find((arg) => !arg.startsWith('--'));
const APPLY = flag('apply');
const PROMO = flag('promo');
const outDir = path.join(__dirname, 'out');
const money = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

function rollback(rollbackFile) {
  const items = JSON.parse(fs.readFileSync(rollbackFile, 'utf8')).changes;
  console.log(`\n  Desfazer ${items.length} alterações de preço (${APPLY ? 'APLICANDO' : 'simulação'})\n`);
  let done = 0;
  items.forEach((item) => {
    if (APPLY) shop.updatePrice(item.productId, item.variantId, item.oldPrice, item.oldCompareAt);
    done += 1;
  });
  console.log(`  ${done} preços ${APPLY ? 'restaurados' : 'seriam restaurados'}\n`);
}

function main() {
  if (option('rollback')) return rollback(option('rollback'));
  const only = option('only');
  if (!file || !['cheaper', 'higher', 'all'].includes(only)) {
    console.error('\n  Uso: node integracoes/tiny/apply-prices-from-export.js export.csv --only=cheaper|higher|all [--promo] [--apply]\n');
    process.exit(1);
  }
  const { products } = loadTinyExport(file);
  const variants = shop.allVariants();
  const bySku = new Map();
  const repeated = new Set();
  variants.forEach((variant) => {
    const sku = String(variant.sku || '').trim();
    if (!sku) return;
    if (bySku.has(sku)) repeated.add(sku);
    bySku.set(sku, variant);
  });

  const changes = [];
  const skipped = { titulo: [], repetido: [], semPreco: 0, inativo: 0 };
  products.forEach((item, sku) => {
    const variant = bySku.get(sku);
    if (!variant) return;
    if (!item.active) return void (skipped.inativo += 1);
    if (!(item.price > 0)) return void (skipped.semPreco += 1);
    if (repeated.has(sku)) return void skipped.repetido.push(sku);
    if (titleSimilarity(item.title, variant.product.title) < 0.6) return void skipped.titulo.push({ sku, tiny: item.title, shopify: variant.product.title });
    const promo = PROMO && item.promo > 0 && item.promo < item.price;
    const target = promo ? item.promo : item.price;
    const compareAt = promo ? item.price : null;
    const current = Number(variant.price);
    if (Math.abs(current - target) < 0.005) return;
    const direction = current < target ? 'cheaper' : 'higher';
    if (only !== 'all' && only !== direction) return;
    changes.push({ sku, title: variant.product.title, productId: variant.product.id, variantId: variant.id, oldPrice: variant.price, oldCompareAt: variant.compareAtPrice, newPrice: target.toFixed(2), newCompareAt: compareAt === null ? null : compareAt.toFixed(2), direction });
  });

  console.log(`\n  Loja: ${shop.STORE} — ${APPLY ? 'APLICANDO' : 'simulação (nada será alterado; use --apply)'}`);
  console.log(`  Escopo: ${only} · ${changes.length} preços a alterar`);
  console.log(`  Ignorados: ${skipped.titulo.length} com título diferente · ${skipped.repetido.length} com SKU repetido na Shopify · ${skipped.semPreco} sem preço · ${skipped.inativo} inativos no Tiny`);
  skipped.titulo.forEach((entry) => console.log(`    ✘ SKU ${entry.sku}: Tiny "${String(entry.tiny).slice(0, 36)}" × Shopify "${String(entry.shopify).slice(0, 36)}"`));
  const sample = changes.slice().sort((a, b) => Math.abs(Number(b.newPrice) - Number(b.oldPrice)) - Math.abs(Number(a.newPrice) - Number(a.oldPrice))).slice(0, 8);
  console.log('\n  Maiores alterações:');
  sample.forEach((c) => console.log(`    ${c.sku.padEnd(14)} ${c.title.slice(0, 40).padEnd(40)} ${money(c.oldPrice)} → ${money(c.newPrice)}`));

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const plan = path.join(outDir, `${APPLY ? 'rollback-prices' : 'plano-prices'}-${stamp}.json`);
  fs.writeFileSync(plan, JSON.stringify({ store: shop.STORE, only, apply: APPLY, changes }, null, 2));
  if (!APPLY) return console.log(`\n  Plano salvo em ${path.relative(process.cwd(), plan)}\n`);

  let ok = 0;
  const failed = [];
  changes.forEach((change) => {
    try {
      shop.updatePrice(change.productId, change.variantId, change.newPrice, change.newCompareAt);
      ok += 1;
    } catch (error) {
      failed.push({ sku: change.sku, error: error.message });
    }
  });
  console.log(`\n  ${ok} preços atualizados · ${failed.length} falhas`);
  failed.forEach((entry) => console.log(`    ✘ ${entry.sku}: ${entry.error}`));
  console.log(`  Para desfazer: node integracoes/tiny/apply-prices-from-export.js --rollback=${path.relative(process.cwd(), plan)} --apply\n`);
}

try {
  main();
} catch (error) {
  console.error(`\n  Erro: ${error.message}\n`);
  process.exit(1);
}
