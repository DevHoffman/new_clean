/*
 * Downloads the public catalogue of the live store so the local preview runs
 * on real products. Only public storefront endpoints are used (no login).
 *
 * Usage: npm run catalog
 */
const fs = require('fs');
const path = require('path');

const STORE = process.env.STORE_URL || 'https://www.distribuidoranewclean.com.br';
const DATA = path.join(__dirname, 'data');

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (theme preview)' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function getAllProducts(base) {
  const products = [];
  for (let page = 1; page < 50; page += 1) {
    const data = await getJson(`${base}?limit=250&page=${page}`);
    if (!data.products || !data.products.length) break;
    products.push(...data.products);
    if (data.products.length < 250) break;
  }
  return products;
}

(async () => {
  const shop = await getJson(`${STORE}/meta.json`);
  const products = await getAllProducts(`${STORE}/products.json`);
  const { collections } = await getJson(`${STORE}/collections.json?limit=250`);

  for (const collection of collections) {
    const items = await getAllProducts(`${STORE}/collections/${collection.handle}/products.json`);
    collection.product_ids = items.map((item) => item.id);
  }

  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'shop.json'), JSON.stringify(shop, null, 2));
  fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(products));
  fs.writeFileSync(path.join(DATA, 'collections.json'), JSON.stringify(collections, null, 2));
  console.log(`Catálogo atualizado: ${products.length} produtos, ${collections.length} coleções.`);
})().catch((error) => {
  console.error('Não foi possível baixar o catálogo:', error.message);
  process.exit(1);
});
