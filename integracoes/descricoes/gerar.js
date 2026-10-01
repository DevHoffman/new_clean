/*
 * Generates product descriptions for products that have none, from what the
 * catalogue really says (title, brand in the title, size, pack, SKU) plus a
 * short, generic sentence per category. It never invents composition, dilution
 * or results: the footer sends the customer to the manufacturer's label.
 *
 *   node integracoes/descricoes/gerar.js                 # preview: writes out/descricoes-preview.csv and prints samples
 *   node integracoes/descricoes/gerar.js --apply --limit=3        # or --handles=handle-a,handle-b
 *   node integracoes/descricoes/gerar.js --apply         # all products without description (bulk operation)
 *   node integracoes/descricoes/gerar.js --rollback=out/descricoes-aplicadas-….json --apply
 *
 * Products that already have a description are never touched.
 * The Tiny does not send descriptions to Shopify (option off), so they are not overwritten
 * by the sync; avoid the Tiny's "enviar para o e-commerce" (full product) button.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const groups = require('../../dev/lib/category-groups');
const shop = require('../tiny/lib/shopify-cli');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => (args.find((arg) => arg.startsWith(`--${name}=`)) || '').slice(name.length + 3) || null;
const APPLY = flag('apply');
const LIMIT = Number(option('limit')) || Infinity;
const HANDLES = option('handles') ? new Set(option('handles').split(',')) : null;
const outDir = path.join(__dirname, '..', 'tiny', 'out');

const strip = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Brands that appear in the titles (token → name as it should be written) */
const BRANDS = {
  AZULIM: 'Azulim', START: 'Start', STARTPRO: 'Start Pro', NOBRE: 'Nobre', POLYLAR: 'Polylar', INDY: 'Indy', AQUAPOOL: 'Aquapool', NEWCLEAN: 'New Clean',
  ONLY: 'Only', VOREL: 'Vorel', MILI: 'Mili', ASSEPTGEL: 'Asseptgel', UPPRO: 'Uppro', FREEPET: 'Freepet', BELIPEL: 'Belipel', ARKILUX: 'Arkilux',
  BIANCO: 'Bianco', TUFF: 'Tuff', ALUMIL: 'Alumil', SKALA: 'Skala', QUALIFOOD: 'Qualifood', PLES: 'Ples', IMBAT: 'Imbat', PENEDO: 'Penedo',
  LAVVE: 'Lavve', GOEDERT: 'Goedert', RODOMAX: 'Rodomax', FORTCOM: 'Fortcom', IPEL: 'Ipel', HPEL: 'Hpel', MABEL: 'Mabel', RADIUM: 'Radium',
  PAPELIAL: 'Papelial', CRISTALCOPO: 'Cristalcopo', BENN: 'Benn', SANTHER: 'Santher', COMFORT: 'Comfort', BOMBRIL: 'Bombril', VEJA: 'Veja',
  VABENE: 'Vabene', MBLIFE: 'MB Life', MAXIMOON: 'Maximoon', TUPI: 'Tupi', ZEROBAC: 'Zerobac', COLGATE: 'Colgate', MAGICO: 'Mágico', GALENO: 'Galeno',
  PROLAR: 'Prolar', ITAPEMIRIM: 'Itapemirim', KAPERCLEAN: 'Kaperclean', TIXAN: 'Tixan', LAVICS: 'Lavics', SOFTSTART: 'Soft Start', COALA: 'Coala',
};

/* One careful sentence per category (what the product is for, nothing more) */
const CATEGORY_TEXT = {
  Desinfetantes: 'Desinfetante para a limpeza e a higienização de ambientes, conforme o modo de uso do rótulo.',
  'Limpadores e multiuso': 'Produto de limpeza para superfícies, conforme o modo de uso do rótulo.',
  'Detergentes e lava-louças': 'Detergente para a limpeza de louças e utensílios, conforme o modo de uso do rótulo.',
  'Sabões e alvejantes': 'Produto para lavagem, limpeza e higienização, conforme o modo de uso do rótulo.',
  Álcool: 'Álcool para limpeza e higienização, conforme as indicações do rótulo.',
  'Papel higiênico e toalha': 'Papel para higiene e uso em banheiros, copas e cozinhas.',
  'Sacos de lixo': 'Saco para acondicionar lixo e descartar resíduos.',
  Descartáveis: 'Descartável para uso em copa, refeições e serviços.',
  'Sabonetes e higiene': 'Produto de higiene pessoal, conforme o modo de uso do rótulo.',
  'Panos, esponjas e fibras': 'Item para a limpeza de superfícies e utensílios.',
  'Vassouras, rodos e cabos': 'Utensílio para a limpeza de pisos e superfícies.',
  Luvas: 'Luva para proteção das mãos em tarefas de limpeza e manuseio.',
  'Aromatizantes e odorizadores': 'Produto para perfumar e reduzir odores em ambientes.',
  'Ceras e tratamento de pisos': 'Produto para o tratamento e a conservação de pisos e superfícies, conforme o modo de uso do rótulo.',
  'Dispensers e suportes': 'Acessório para organizar e dispensar produtos de higiene e limpeza.',
  'Café, açúcar e copa': 'Item para copa e cozinha.',
};

function category(title) {
  const name = strip(title);
  for (const [group, words] of Object.entries(groups)) {
    if (words.some((word) => name.startsWith(`${word} `) || name.startsWith(`${word}S `) || name === word)) return group;
  }
  return null;
}

/* Readable title for running text: connectors in lower case, units spaced ("2KG" → "2 kg") */
function displayTitle(title) {
  const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'em', 'sem', 'a', 'o', 'c']);
  const unit = (value, name) => {
    const lower = name.toLowerCase();
    return `${value} ${['l', 'lt', 'lts'].includes(lower) ? 'L' : lower}`;
  };
  const allCaps = title === title.toUpperCase();
  return title.trim().split(/\s+/).map((word, index) => {
    const lower = word.toLowerCase();
    const measured = word.match(/^(\d+(?:[.,]\d+)?)(KG|G|GR|ML|L|LT|LTS|M|MT|CM|MM)$/i);
    if (measured) return unit(measured[1], measured[2]);
    if (!allCaps) return word;
    if (/\//.test(word) || /\d/.test(word)) return word;
    if (connectors.has(lower) && index > 0) return lower;
    if (word.length <= 2) return word;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function brandOf(title) {
  const tokens = strip(title).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) if (BRANDS[tokens[i]]) return BRANDS[tokens[i]];
  return null;
}

const NEEDS_LABEL = new Set(['Desinfetantes', 'Limpadores e multiuso', 'Detergentes e lava-louças', 'Sabões e alvejantes', 'Álcool', 'Ceras e tratamento de pisos', 'Aromatizantes e odorizadores', 'Sabonetes e higiene']);
const number = (text) => String(text).replace(',', '.').replace(/\.0+$/, '').replace('.', ',');

function details(title) {
  const t = strip(title).replace(/,/g, '.');
  const out = {};
  const single = t.match(/(?<![\dX.])(\d+(?:\.\d+)?)\s?(ML|L|LT|LTS|LITRO|LITROS|KG|G|GR)\b(?!\s?X)/);
  if (single && !/\bX\s?\d/.test(t.slice(Math.max(0, single.index - 3), single.index))) {
    const value = number(single[1]);
    const unit = single[2];
    if (unit === 'ML') out.conteudo = `${value} ml`;
    else if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(unit)) out.conteudo = `${value} ${Number(single[1]) === 1 ? 'litro' : 'litros'}`;
    else if (unit === 'KG') out.conteudo = `${value} kg`;
    else out.conteudo = `${value} g`;
  }
  const sheets = t.match(/(\d+)\s?(FLS|FLHS|FOLHAS)\b/);
  if (sheets) out.folhas = `${sheets[1]} folhas`;
  const rolls = t.match(/(\d+)\s?(RLS|ROLOS)\b/);
  if (rolls) out.rolos = `${rolls[1]} rolos`;
  const pack = t.match(/\bC\/\s?(\d+)(?!\s?(ML|L|G|KG|FLS|FLHS|RLS|M|MM|CM))\b/) || t.match(/(\d+)\s?(UN|UND|UNID|UNIDADES)\b/);
  if (pack && !out.folhas) out.embalagem = `${pack[1]} unidades`;
  return out;
}

function describe(product) {
  const title = displayTitle(product.title);
  const group = category(product.title);
  const brand = brandOf(product.title);
  const d = details(product.title);
  const sku = (product.variants.nodes[0] && product.variants.nodes[0].sku) || '';
  const bullets = [];
  if (brand) bullets.push(['Marca', brand]);
  if (d.conteudo) bullets.push(['Conteúdo', d.conteudo]);
  if (d.folhas) bullets.push(['Folhas', d.folhas.replace(' folhas', '')]);
  if (d.rolos) bullets.push(['Rolos', d.rolos.replace(' rolos', '')]);
  if (d.embalagem) bullets.push(['Embalagem', d.embalagem]);
  if (sku) bullets.push(['Código', sku]);
  const pool = /AQUAPOOL|PISCINA/.test(strip(product.title));
  const sentence = pool ? ' Produto para o tratamento e a manutenção de piscinas, conforme o modo de uso do rótulo.' : group ? ` ${CATEGORY_TEXT[group]}` : '';
  const html = [
    `<p><strong>${escapeHtml(title)}</strong>.${sentence}</p>`,
    bullets.length ? `<ul>${bullets.map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul>` : '',
    `<p>Vendemos para residências e empresas, com nota fiscal e entrega na Grande Vitória. ${(NEEDS_LABEL.has(group) || pool) ? 'Consulte o rótulo do fabricante para modo de uso, diluição e precauções.' : 'Consulte as informações da embalagem do fabricante.'}</p>`,
  ].filter(Boolean).join('');
  return { html, group, brand, ...d };
}

function fetchProducts() {
  const nodes = [];
  let after = null;
  for (;;) {
    const data = shop.run(
      `query($after: String) { products(first: 200, after: $after, query: "status:active") { nodes { id title handle descriptionHtml variants(first: 1) { nodes { sku } } } pageInfo { hasNextPage endCursor } } }`,
      { after }
    );
    nodes.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) return nodes;
    after = data.products.pageInfo.endCursor;
  }
}

function rollback(file) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8')).products;
  console.log(`\n  Desfazer ${items.length} descrições (${APPLY ? 'APLICANDO' : 'simulação'})\n`);
  if (!APPLY) return;
  const lines = items.map((item) => JSON.stringify({ product: { id: item.id, descriptionHtml: item.previous } }));
  runBulk(lines);
}

function runBulk(lines) {
  fs.mkdirSync(outDir, { recursive: true });
  const variableFile = path.join(outDir, 'descricoes-bulk.jsonl');
  fs.writeFileSync(variableFile, `${lines.join('\n')}\n`);
  const cli = (process.env.SHOPIFY_CLI || 'npx --no-install shopify').split(' ');
  const run = spawnSync(cli[0], [...cli.slice(1), 'store', 'bulk', 'execute', '--store', shop.STORE, '--allow-mutations', '--watch', '--query', 'mutation call($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id } userErrors { field message } } }', '--variable-file', variableFile], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, cwd: path.join(__dirname, '..', '..') });
  const text = `${run.stdout}${run.stderr}`;
  const errors = (text.match(/"userErrors":\s*\[\s*\{/g) || []).length;
  console.log(run.status === 0 ? `  Operação em massa concluída (${errors} produto(s) com erro de validação)` : `  Falha: ${text.slice(-500)}`);
}

function main() {
  if (option('rollback')) return rollback(option('rollback'));
  const products = fetchProducts();
  const empty = products.filter((product) => !String(product.descriptionHtml || '').trim() && !/^example product$/i.test(product.title.trim()));
  const targets = empty.filter((product) => !HANDLES || HANDLES.has(product.handle)).slice(0, LIMIT).map((product) => ({ product, ...describe(product) }));
  console.log(`\n  ${products.length} produtos ativos · ${empty.length} sem descrição · ${targets.length} a gerar (${APPLY ? 'APLICANDO' : 'prévia'})`);
  const withCategory = targets.filter((item) => item.group).length;
  const withBrand = targets.filter((item) => item.brand).length;
  const withSize = targets.filter((item) => item.conteudo).length;
  console.log(`  com categoria reconhecida: ${withCategory} · com marca: ${withBrand} · com conteúdo (volume/peso): ${withSize}`);

  fs.mkdirSync(outDir, { recursive: true });
  const csv = ['handle;titulo;categoria;marca;html'].concat(targets.map((item) => [item.product.handle, `"${item.product.title}"`, item.group || '', item.brand || '', `"${item.html.replace(/"/g, '""')}"`].join(';')));
  fs.writeFileSync(path.join(outDir, 'descricoes-preview.csv'), `﻿${csv.join('\n')}\n`);
  if (!APPLY) {
    const picks = [];
    const seen = new Set();
    targets.forEach((item) => { const key = item.group || 'sem'; if (!seen.has(key) && picks.length < 10) { seen.add(key); picks.push(item); } });
    picks.forEach((item) => console.log(`\n  [${item.group || 'sem categoria'}] ${item.product.title}\n  ${item.html.replace(/<\/p>|<\/ul>/g, '\n  ').replace(/<li>/g, '  • ').replace(/<\/li>/g, '\n  ').replace(/<[^>]+>/g, '').replace(/\n\s*\n/g, '\n').trim()}`));
    return console.log(`\n  Prévia completa: ${path.relative(process.cwd(), path.join(outDir, 'descricoes-preview.csv'))}\n`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const record = path.join(outDir, `descricoes-aplicadas-${stamp}.json`);
  fs.writeFileSync(record, JSON.stringify({ products: targets.map((item) => ({ id: item.product.id, handle: item.product.handle, previous: item.product.descriptionHtml || '' })) }, null, 2));
  if (targets.length <= 5) {
    targets.forEach((item) => {
      const data = shop.run('mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id } userErrors { field message } } }', { product: { id: item.product.id, descriptionHtml: item.html } });
      const errs = data.productUpdate.userErrors;
      console.log(`  ${errs.length ? '✘' : '✔'} ${item.product.handle}${errs.length ? ' ' + JSON.stringify(errs) : ''}`);
    });
  } else {
    runBulk(targets.map((item) => JSON.stringify({ product: { id: item.product.id, descriptionHtml: item.html } })));
  }
  console.log(`  Para desfazer: node integracoes/descricoes/gerar.js --rollback=${path.relative(process.cwd(), record)} --apply\n`);
}

try {
  main();
} catch (error) {
  console.error(`\n  Erro: ${error.message}\n`);
  process.exit(1);
}
