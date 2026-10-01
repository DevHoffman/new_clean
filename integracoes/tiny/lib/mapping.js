/* Tiny → Shopify field mapping. Pure functions, no network. */

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const name = (value) => (value && typeof value === 'object' ? value.nome || value.descricao || '' : value || '');

/* A promotional price below the regular one becomes "price" + "compare at",
   which is what makes the home's promotions block appear. */
function prices(detail, listItem) {
  const source = (detail && detail.precos) || (listItem && listItem.precos) || {};
  const regular = toNumber(source.preco);
  const promo = toNumber(source.precoPromocional);
  if (regular === null || regular <= 0) return null;
  if (promo !== null && promo > 0 && promo < regular) return { price: promo.toFixed(2), compareAt: regular.toFixed(2) };
  return { price: regular.toFixed(2), compareAt: null };
}

/* Units available for sale (Tiny's "disponivel" discounts reserved units) */
function stockQuantity(stock) {
  const value = toNumber(stock && (stock.disponivel !== undefined ? stock.disponivel : stock.saldo));
  return value === null ? null : Math.max(0, Math.floor(value));
}

function content(listItem, detail) {
  const attachments = ((detail && detail.anexos) || []).filter((item) => item && item.url);
  return {
    title: String((detail && detail.descricao) || listItem.descricao || '').trim(),
    descriptionHtml: String((detail && detail.descricaoComplementar) || '').trim(),
    vendor: String(name(detail && detail.marca) || '').trim(),
    productType: String(name(detail && detail.categoria) || '').trim(),
    images: attachments.map((item) => item.url),
  };
}

/* Only simple products are synced; variations, kits and manufactured items need their own mapping */
const isSimple = (listItem) => !listItem.tipo || listItem.tipo === 'S';

const sameMoney = (a, b) => (a === null || a === undefined ? b === null || b === undefined : b !== null && b !== undefined && Number(a) === Number(b));

module.exports = { toNumber, prices, stockQuantity, content, isSimple, sameMoney };
