/* Reads the products CSV exported from the Tiny (separator ; or ,; UTF-8 or Latin-1). */
const fs = require('fs');

const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const toNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  let text = String(value).replace(/[^\d.,-]/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

function parseCsv(buffer) {
  let text = buffer.toString('utf8');
  if (text.includes('�')) text = buffer.toString('latin1');
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0];
  const separator = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* → { products: Map(sku → item), columns } */
function loadTinyExport(file) {
  const rows = parseCsv(fs.readFileSync(file));
  const header = rows[0].map(normalize);
  const find = (...names) => header.findIndex((name) => names.some((candidate) => name === candidate || name.startsWith(candidate)));
  const col = {
    sku: find('codigo (sku)', 'codigo', 'sku'),
    title: find('descricao', 'nome'),
    price: find('preco de venda', 'preco'),
    promo: find('preco promocional', 'promocional'),
    stock: find('estoque', 'saldo'),
    status: find('situacao'),
    brand: find('marca'),
    category: find('categoria'),
  };
  if (col.sku < 0 || col.price < 0) throw new Error(`Não achei as colunas de código e preço. Cabeçalho: ${rows[0].join(' | ')}`);
  const products = new Map();
  rows.slice(1).forEach((row) => {
    const sku = String(row[col.sku] || '').trim();
    if (!sku) return;
    products.set(sku, {
      sku,
      title: col.title >= 0 ? row[col.title] : '',
      price: toNumber(row[col.price]),
      promo: col.promo >= 0 ? toNumber(row[col.promo]) : null,
      stock: col.stock >= 0 ? toNumber(row[col.stock]) : null,
      active: col.status >= 0 ? /ativ/.test(normalize(row[col.status])) && !/inativ/.test(normalize(row[col.status])) : true,
      brand: col.brand >= 0 ? row[col.brand] : '',
      category: col.category >= 0 ? row[col.category] : '',
    });
  });
  return { products, columns: col, header: rows[0] };
}

/* Share of the shorter title's words found in the other title (0–1) */
function titleSimilarity(a, b) {
  const words = (text) => new Set(normalize(text).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((word) => word.length > 1));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((word) => B.has(word) && (shared += 1));
  return shared / Math.min(A.size, B.size);
}

module.exports = { loadTinyExport, titleSimilarity, normalize, toNumber };
