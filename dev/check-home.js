/*
 * Checks that the home page is fully populated and that none of its links
 * lands on an empty page, using the 50-product sample (PREVIEW_SAMPLE=1).
 *
 * Usage: node dev/check-home.js          (also: npm run check:home)
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3510;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (ok, label, detail = '') => results.push({ ok, label, detail });
const count = (html, pattern) => (html.match(pattern) || []).length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url) {
  const response = await fetch(`${BASE}${url}`, { redirect: 'manual' });
  return { status: response.status, html: await response.text() };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(BASE);
      return;
    } catch (error) {
      await sleep(250);
    }
  }
  throw new Error('o servidor de pré-visualização não iniciou');
}

(async () => {
  const server = spawn('node', [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), PREVIEW_SAMPLE: '1' },
    stdio: 'ignore',
  });
  try {
    await waitForServer();
    const home = (await get('/')).html;

    // Blocks that must show products
    check(count(home, /class="hero-product /g) >= 3, 'Banner: vitrine com 3 produtos', `${count(home, /class="hero-product /g)}`);
    check(count(home, /category-tiles__link/g) >= 8 * 2, 'Categorias: 8 itens no carrossel', `${count(home, /category-tiles__link/g) / 2}`);
    const sections = home.split(/<div\s+class="section scheme-[a-z]+ featured-collection/).slice(1);
    check(sections.length === 2, 'Mais vendidos e Novidades presentes', `${sections.length} seções`);
    sections.forEach((chunk, index) => {
      const cards = count(chunk.split(/<div\s+class="section scheme-/)[0], /<div\s+class="product-card[ "]/g);
      check(cards >= 4, `Vitrine ${index + 1}: pelo menos 4 produtos`, `${cards}`);
    });
    const promoHtml = (home.split('promo-showcase__grid')[1] || '').split('promo-showcase__all')[0];
    check(home.includes('promo-feature'), 'Promoções: produto em destaque');
    check(count(promoHtml, /promo-showcase__cell/g) >= 3, 'Promoções: 3 cards ao lado', `${count(promoHtml, /promo-showcase__cell/g)}`);
    check(count(home, /brand-list__item/g) >= 12, 'Marcas presentes', `${count(home, /brand-list__item/g) / 2}`);
    check(count(home, /<li[^>]*>\s*<a class="search-product"/g) >= 12, 'Busca: Mais vendidos + Novidades com produtos', `${count(home, /<a class="search-product"/g)}`);
    check(count(home, /b2b-cta__product/g) >= 3, 'Empresas: 3 fotos de produtos');

    // Every internal link of the home must lead somewhere useful
    const hrefs = Array.from(new Set((home.match(/href="(\/[^"#]*)"/g) || []).map((item) => item.slice(6, -1).replace(/&amp;/g, '&'))));
    const pagesNeeded = [];
    for (const href of hrefs) {
      if (/^\/(cart|account|policies|collections\/all\?|password)/.test(href) || href === '/' || href === '/search') continue;
      const { status, html } = await get(href);
      const products = count(html, /<div\s+class="product-card[ "]/g);
      if (href.startsWith('/pages/')) {
        pagesNeeded.push(href);
        continue;
      }
      if (href.startsWith('/search') || (href.startsWith('/collections/') && href !== '/collections/all')) {
        check(status === 200 && products > 0, `Link ${href}`, `${products} produto(s)`);
      } else if (href.startsWith('/products/')) {
        check(status === 200, `Link ${href}`, `HTTP ${status}`);
      }
    }
    if (pagesNeeded.length) console.log(`\n  Páginas que precisam existir na loja: ${pagesNeeded.join(', ')}`);
  } finally {
    server.kill();
  }

  const failed = results.filter((item) => !item.ok);
  results.forEach((item) => console.log(`  ${item.ok ? '✔' : '✘'} ${item.label}${item.detail ? `  (${item.detail})` : ''}`));
  console.log(`\n  ${results.length - failed.length}/${results.length} verificações ok\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(`\n  Erro: ${error.message}\n`);
  process.exit(1);
});
