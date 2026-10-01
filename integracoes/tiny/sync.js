/*
 * Tiny ERP → Shopify product sync.
 *
 * Safe by default: without --apply nothing is written, it only reports what it
 * would do. It never deletes or archives anything. Products are matched by SKU,
 * so the products already in the store are updated, never duplicated.
 *
 *   npm run tiny:sync                         # simulation of price + stock
 *   npm run tiny:sync -- --apply              # writes price + stock
 *   npm run tiny:sync -- --apply --content    # also title, description, brand, type, photo (if none)
 *   npm run tiny:sync -- --apply --create     # also creates products that are not in the store yet
 *
 * Options
 *   --only=price,stock     what to sync for existing products (default: price,stock)
 *   --content              update title, description, brand (vendor) and type from the Tiny
 *   --replace-images       with --content, replace photos instead of only filling missing ones
 *   --create               create products missing in the store (as DRAFT unless --publish-new)
 *   --publish-new          new products go live immediately
 *   --sku=A,B              only these SKUs        --limit=N   only the first N Tiny products
 *   --concurrency=N        parallel products (default 3)
 *   --verbose              list every change
 */
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const tiny = require('./lib/tiny-client');
const shop = require('./lib/shopify-client');
const map = require('./lib/mapping');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const found = argv.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const APPLY = flag('apply');
const ONLY = new Set(option('only', 'price,stock').split(','));
const CONTENT = flag('content');
const CREATE = flag('create');
const REPLACE_IMAGES = flag('replace-images');
const PUBLISH_NEW = flag('publish-new');
const VERBOSE = flag('verbose');
const SKUS = option('sku') ? new Set(option('sku').split(',').map((sku) => sku.trim())) : null;
const LIMIT = Number(option('limit', 0)) || Infinity;
const CONCURRENCY = Number(option('concurrency', 3)) || 3;

const counts = { tiny: 0, simple: 0, skippedType: 0, noSku: 0, duplicated: 0, notInStore: 0, created: 0, price: 0, stock: 0, stockSkipped: 0, content: 0, images: 0, unchanged: 0, errors: 0 };
const changes = [];
const errors = [];
const log = (line) => (VERBOSE || !APPLY) && console.log(`  ${line}`);

async function processProduct(item, index, location) {
  const sku = String(item.sku || '').trim();
  const existing = index.bySku.get(sku);
  const label = `${sku} · ${String(item.descricao || '').slice(0, 50)}`;

  if (!existing && !CREATE) {
    counts.notInStore += 1;
    return;
  }

  const needDetail = !existing || CONTENT || ONLY.has('stock') || !(item.precos && item.precos.preco !== undefined);
  const detail = needDetail ? await tiny.getProduct(item.id) : null;
  const price = map.prices(detail, item);
  const done = [];

  if (!existing) {
    if (!price) return void log(`– ${label}: sem preço no Tiny, não criado`);
    const fields = map.content(item, detail);
    done.push(`criar (${PUBLISH_NEW ? 'publicado' : 'rascunho'}) R$ ${price.price}`);
    if (APPLY) {
      const created = await shop.createProduct({
        title: fields.title,
        descriptionHtml: fields.descriptionHtml,
        vendor: fields.vendor || 'DISTRIBUIDORA NEW CLEAN',
        productType: fields.productType,
        tags: [],
        status: PUBLISH_NEW ? 'ACTIVE' : 'DRAFT',
        sku,
        price: price.price,
        compareAt: price.compareAt,
      });
      await shop.addImages(created.productId, fields.images, fields.title);
      const quantity = map.stockQuantity(await tiny.getStock(item.id));
      if (quantity !== null) await shop.setStock(created.inventoryItemId, location, quantity);
    }
    counts.created += 1;
    changes.push({ sku, actions: done });
    return void log(`+ ${label}: ${done.join(', ')}`);
  }

  // Price
  if (ONLY.has('price') && price && !(map.sameMoney(existing.price, price.price) && map.sameMoney(existing.compareAtPrice, price.compareAt))) {
    done.push(`preço ${existing.price} → ${price.price}${price.compareAt ? ` (de ${price.compareAt})` : ''}`);
    if (APPLY) await shop.updateVariantPrice(existing.product.id, existing.id, { price: price.price, compareAt: price.compareAt });
    counts.price += 1;
  }

  // Stock
  if (ONLY.has('stock')) {
    if (detail && detail.estoque && detail.estoque.controlar === false) {
      counts.stockSkipped += 1;
    } else {
      const quantity = map.stockQuantity(await tiny.getStock(item.id));
      if (quantity !== null && (existing.stock !== quantity || !existing.inventoryItem.tracked)) {
        done.push(`estoque ${existing.stock === null ? '—' : existing.stock} → ${quantity}`);
        if (APPLY) await shop.setStock(existing.inventoryItem.id, location, quantity);
        counts.stock += 1;
      }
    }
  }

  // Content (opt-in: it overwrites what was typed in the Shopify admin)
  if (CONTENT && detail) {
    const fields = map.content(item, detail);
    const update = {};
    if (fields.title && fields.title !== existing.product.title) update.title = fields.title;
    if (fields.descriptionHtml && fields.descriptionHtml !== existing.product.descriptionHtml) update.descriptionHtml = fields.descriptionHtml;
    if (fields.vendor && fields.vendor !== existing.product.vendor) update.vendor = fields.vendor;
    if (fields.productType && fields.productType !== existing.product.productType) update.productType = fields.productType;
    if (Object.keys(update).length) {
      done.push(`conteúdo (${Object.keys(update).join(', ')})`);
      if (APPLY) await shop.updateContent(existing.product.id, update);
      counts.content += 1;
    }
    if (fields.images.length && (!existing.product.featuredMedia || REPLACE_IMAGES)) {
      done.push(`fotos (${fields.images.length})`);
      if (APPLY) await shop.addImages(existing.product.id, fields.images, fields.title || existing.product.title);
      counts.images += 1;
    }
  }

  if (done.length) {
    changes.push({ sku, actions: done });
    log(`~ ${label}: ${done.join(', ')}`);
  } else {
    counts.unchanged += 1;
  }
}

async function main() {
  console.log(`\n  Loja: ${config.shopify.store} — ${APPLY ? 'APLICANDO' : 'simulação (nada será alterado; use --apply)'}`);
  console.log(`  Sincroniza: ${[...ONLY].join(' + ')}${CONTENT ? ' + conteúdo' : ''}${CREATE ? ' + produtos novos' : ''}\n`);

  const location = await shop.primaryLocationId();
  const index = await shop.variantIndex(location);
  console.log(`  Shopify: ${index.bySku.size} variantes com SKU${index.duplicated.size ? `, ${index.duplicated.size} SKU(s) repetido(s) (ignorados)` : ''}`);

  const queue = [];
  for await (const item of tiny.listProducts({ situacao: 'A' })) {
    counts.tiny += 1;
    const sku = String(item.sku || '').trim();
    if (!map.isSimple(item)) { counts.skippedType += 1; continue; }
    if (!sku) { counts.noSku += 1; continue; }
    if (index.duplicated.has(sku)) { counts.duplicated += 1; continue; }
    if (SKUS && !SKUS.has(sku)) continue;
    counts.simple += 1;
    if (queue.length < LIMIT) queue.push(item);
  }
  console.log(`  Tiny: ${counts.tiny} produtos ativos, ${queue.length} a processar\n`);

  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const item = queue[next];
      next += 1;
      try {
        await processProduct(item, index, location);
      } catch (error) {
        counts.errors += 1;
        errors.push({ sku: item.sku, error: error.message });
        console.error(`  ✘ ${item.sku}: ${error.message}`);
      }
    }
  });
  await Promise.all(workers);

  console.log('\n  Resumo');
  console.log(`    preços a atualizar ........ ${counts.price}`);
  console.log(`    estoques a atualizar ...... ${counts.stock}${counts.stockSkipped ? ` (${counts.stockSkipped} sem controle de estoque no Tiny, mantidos)` : ''}`);
  if (CONTENT) console.log(`    conteúdos / fotos ......... ${counts.content} / ${counts.images}`);
  if (CREATE) console.log(`    produtos criados .......... ${counts.created}`);
  else console.log(`    no Tiny e fora da loja .... ${counts.notInStore} (use --create para criar)`);
  console.log(`    sem alteração ............. ${counts.unchanged}`);
  console.log(`    ignorados ................. ${counts.skippedType} (tipo não simples) · ${counts.noSku} sem SKU · ${counts.duplicated} SKU repetido`);
  console.log(`    erros ..................... ${counts.errors}\n`);

  fs.mkdirSync(config.outDir, { recursive: true });
  const report = path.join(config.outDir, `sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(report, JSON.stringify({ apply: APPLY, counts, changes, errors }, null, 2));
  console.log(`  Relatório: ${path.relative(process.cwd(), report)}\n`);
  process.exit(counts.errors ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n  Erro: ${error.message}\n`);
  process.exit(1);
});
