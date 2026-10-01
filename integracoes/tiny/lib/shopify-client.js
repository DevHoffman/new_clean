/* Minimal Shopify Admin GraphQL client (custom app token). */
const config = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function graphql(query, variables = {}, attempt = 0) {
  const endpoint = config.shopify.endpoint || `https://${config.shopify.store}/admin/api/${config.shopify.version}/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': config.shopify.token },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 429 && attempt < 5) {
    await sleep(2000 * (attempt + 1));
    return graphql(query, variables, attempt + 1);
  }
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  const throttled = (json.errors || []).some((error) => error.extensions && error.extensions.code === 'THROTTLED');
  if (throttled && attempt < 5) {
    await sleep(2000 * (attempt + 1));
    return graphql(query, variables, attempt + 1);
  }
  if (json.errors) throw new Error(`Shopify: ${JSON.stringify(json.errors).slice(0, 400)}`);
  return json.data;
}

const problems = (payload) => ((payload && payload.userErrors) || []).map((error) => `${(error.field || []).join('.')}: ${error.message}`).join('; ');

/* sku → variant, for every variant of the store */
async function variantIndex(locationId) {
  const bySku = new Map();
  const duplicated = new Set();
  let after = null;
  for (;;) {
    const data = await graphql(
      `query VariantIndex($after: String, $location: ID!) {
        productVariants(first: 250, after: $after) {
          nodes {
            id sku price compareAtPrice
            inventoryItem {
              id tracked
              inventoryLevel(locationId: $location) { quantities(names: ["available"]) { name quantity } }
            }
            product { id title status descriptionHtml vendor productType tags featuredMedia { id } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after, location: locationId }
    );
    data.productVariants.nodes.forEach((variant) => {
      const sku = (variant.sku || '').trim();
      if (!sku) return;
      const level = variant.inventoryItem && variant.inventoryItem.inventoryLevel;
      const available = level ? (level.quantities.find((item) => item.name === 'available') || {}).quantity : undefined;
      variant.stock = available === undefined ? null : available;
      if (bySku.has(sku)) duplicated.add(sku);
      bySku.set(sku, variant);
    });
    if (!data.productVariants.pageInfo.hasNextPage) break;
    after = data.productVariants.pageInfo.endCursor;
  }
  return { bySku, duplicated };
}

async function primaryLocationId() {
  if (config.shopify.locationId) return config.shopify.locationId.startsWith('gid://') ? config.shopify.locationId : `gid://shopify/Location/${config.shopify.locationId}`;
  const data = await graphql('query Locations { locations(first: 5, includeInactive: false) { nodes { id name isPrimary } } }');
  const nodes = data.locations.nodes;
  const primary = nodes.find((node) => node.isPrimary) || nodes[0];
  if (!primary) throw new Error('A loja não tem local de estoque');
  return primary.id;
}

async function updateVariantPrice(productId, variantId, { price, compareAt }) {
  const data = await graphql(
    `mutation UpdatePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`,
    { productId, variants: [{ id: variantId, price: String(price), compareAtPrice: compareAt === null ? null : String(compareAt) }] }
  );
  const problem = problems(data.productVariantsBulkUpdate);
  if (problem) throw new Error(problem);
}

async function setStock(inventoryItemId, locationId, quantity, { activate = true } = {}) {
  // Stock only counts when the item is tracked; activating is a no-op when it already is
  const tracked = await graphql(
    `mutation Track($id: ID!) { inventoryItemUpdate(id: $id, input: { tracked: true }) { userErrors { field message } } }`,
    { id: inventoryItemId }
  );
  if (problems(tracked.inventoryItemUpdate)) throw new Error(problems(tracked.inventoryItemUpdate));
  if (activate) {
    await graphql(
      `mutation Activate($item: ID!, $location: ID!) { inventoryActivate(inventoryItemId: $item, locationId: $location) { userErrors { field message } } }`,
      { item: inventoryItemId, location: locationId }
    );
  }
  const data = await graphql(
    `mutation SetStock($input: InventorySetQuantitiesInput!) { inventorySetQuantities(input: $input) { userErrors { field message } } }`,
    { input: { name: 'available', reason: 'correction', ignoreCompareQuantity: true, quantities: [{ inventoryItemId, locationId, quantity }] } }
  );
  const problem = problems(data.inventorySetQuantities);
  if (problem) throw new Error(problem);
}

async function updateContent(productId, fields) {
  const data = await graphql(
    `mutation UpdateContent($product: ProductUpdateInput!) { productUpdate(product: $product) { userErrors { field message } } }`,
    { product: { id: productId, ...fields } }
  );
  const problem = problems(data.productUpdate);
  if (problem) throw new Error(problem);
}

async function addImages(productId, urls, alt) {
  if (!urls.length) return;
  const data = await graphql(
    `mutation AddImages($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { mediaUserErrors { field message } } }`,
    { productId, media: urls.map((url) => ({ originalSource: url, alt, mediaContentType: 'IMAGE' })) }
  );
  const problem = ((data.productCreateMedia && data.productCreateMedia.mediaUserErrors) || []).map((e) => e.message).join('; ');
  if (problem) throw new Error(problem);
}

async function createProduct({ title, descriptionHtml, vendor, productType, tags, status, sku, price, compareAt }) {
  const created = await graphql(
    `mutation CreateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id variants(first: 1) { nodes { id inventoryItem { id } } } }
        userErrors { field message }
      }
    }`,
    { product: { title, descriptionHtml, vendor, productType, tags, status } }
  );
  const problem = problems(created.productCreate);
  if (problem) throw new Error(problem);
  const product = created.productCreate.product;
  const variant = product.variants.nodes[0];
  const data = await graphql(
    `mutation FillVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`,
    {
      productId: product.id,
      variants: [{ id: variant.id, price: String(price), compareAtPrice: compareAt === null ? null : String(compareAt), inventoryItem: { sku, tracked: true } }],
    }
  );
  const fillProblem = problems(data.productVariantsBulkUpdate);
  if (fillProblem) throw new Error(fillProblem);
  return { productId: product.id, variantId: variant.id, inventoryItemId: variant.inventoryItem.id };
}

module.exports = { variantIndex, primaryLocationId, updateVariantPrice, setStock, updateContent, addImages, createProduct };
