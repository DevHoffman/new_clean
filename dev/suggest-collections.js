/*
 * Suggests automatic collections for the catalogue, based on the first words
 * of product titles. Output: dev/data/collections-suggested.json and a table
 * in the terminal, ready to be created in Shopify admin as automatic
 * collections with the condition "Título do produto contém <palavra>".
 *
 * Usage: node dev/suggest-collections.js
 */
const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf8'));

const normalize = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

const GROUPS = require('./lib/category-groups');

const result = {};
const used = new Set();
Object.entries(GROUPS).forEach(([title, words]) => {
  const matches = products.filter((product) => {
    const name = normalize(product.title);
    return words.some((word) => name.startsWith(`${word} `) || name.startsWith(`${word}S `) || name === word);
  });
  matches.forEach((product) => used.add(product.id));
  result[title] = { conditions: words.map((word) => `Título do produto começa com "${word}"`), count: matches.length, examples: matches.slice(0, 3).map((p) => p.title) };
});

const leftovers = products.filter((product) => !used.has(product.id));
fs.writeFileSync(path.join(__dirname, 'data', 'collections-suggested.json'), JSON.stringify({ collections: result, uncategorised: leftovers.map((p) => p.title) }, null, 2));

console.log('\n  Coleções sugeridas (condição: título começa com a palavra):\n');
Object.entries(result)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([title, info]) => console.log(`  ${String(info.count).padStart(4)}  ${title}`));
console.log(`\n  ${leftovers.length} produtos fora das categorias acima (lista em dev/data/collections-suggested.json)\n`);
