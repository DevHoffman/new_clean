/*
 * Pixel personalizado GA4 para Shopify (Configurações > Eventos do cliente >
 * Adicionar pixel personalizado). Rastreia o funil completo, inclusive o
 * checkout, que o tema não enxerga.
 *
 * Use SÓ se não instalar o app oficial "Google & YouTube" (ele já envia estes
 * eventos). Nunca os dois juntos, ou as vendas serão contadas em dobro.
 *
 * 1. Troque G-XXXXXXXXXX pelo ID de medição do GA4.
 * 2. Permissão: "Não obrigatório" ou conforme o seu banner de cookies.
 * 3. Salve e clique em Conectar.
 */
const MEASUREMENT_ID = 'G-XXXXXXXXXX';

const script = document.createElement('script');
script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
script.async = true;
document.head.appendChild(script);

window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', MEASUREMENT_ID, { send_page_view: false });

const money = (value) => (value && value.amount != null ? Number(value.amount) : undefined);

const lineToItem = (line) => ({
  item_id: (line.variant && (line.variant.sku || line.variant.id)) || undefined,
  item_name: line.title || (line.variant && line.variant.product && line.variant.product.title),
  price: line.variant ? money(line.variant.price) : undefined,
  quantity: line.quantity,
});

const checkoutPayload = (checkout) => ({
  currency: checkout.currencyCode,
  value: money(checkout.totalPrice),
  coupon: (checkout.discountApplications || []).map((discount) => discount.title).filter(Boolean).join(',') || undefined,
  items: (checkout.lineItems || []).map(lineToItem),
});

analytics.subscribe('page_viewed', (event) => {
  gtag('event', 'page_view', {
    page_location: event.context.document.location.href,
    page_title: event.context.document.title,
  });
});

analytics.subscribe('search_submitted', (event) => {
  gtag('event', 'search', { search_term: event.data.searchResult.query });
});

analytics.subscribe('product_viewed', (event) => {
  const variant = event.data.productVariant;
  gtag('event', 'view_item', {
    currency: variant.price.currencyCode,
    value: money(variant.price),
    items: [{ item_id: variant.sku || variant.id, item_name: variant.product.title, price: money(variant.price) }],
  });
});

analytics.subscribe('product_added_to_cart', (event) => {
  const line = event.data.cartLine;
  const variant = line.merchandise;
  gtag('event', 'add_to_cart', {
    currency: variant.price.currencyCode,
    value: money(line.cost && line.cost.totalAmount),
    items: [{ item_id: variant.sku || variant.id, item_name: variant.product.title, price: money(variant.price), quantity: line.quantity }],
  });
});

analytics.subscribe('checkout_started', (event) => {
  gtag('event', 'begin_checkout', checkoutPayload(event.data.checkout));
});

analytics.subscribe('checkout_shipping_info_submitted', (event) => {
  gtag('event', 'add_shipping_info', checkoutPayload(event.data.checkout));
});

analytics.subscribe('payment_info_submitted', (event) => {
  gtag('event', 'add_payment_info', checkoutPayload(event.data.checkout));
});

analytics.subscribe('checkout_completed', (event) => {
  const checkout = event.data.checkout;
  gtag('event', 'purchase', {
    ...checkoutPayload(checkout),
    transaction_id: (checkout.order && checkout.order.id) || checkout.token,
    shipping: money(checkout.shippingLine && checkout.shippingLine.price),
    tax: money(checkout.totalTax),
  });
});
