/* Shopify Admin GraphQL through the authorized Shopify CLI (`shopify store execute`). */
const { spawnSync } = require('child_process');
const path = require('path');

const STORE = process.env.SHOPIFY_STORE || 'dfd10g-i2.myshopify.com';
const CLI = (process.env.SHOPIFY_CLI || 'npx --no-install shopify').split(' ');

function run(query, variables = {}) {
  const args = [...CLI.slice(1), 'store', 'execute', '--store', STORE, '--json', '--query', query, '--variables', JSON.stringify(variables)];
  if (/^\s*mutation/.test(query)) args.push('--allow-mutations');
  const result = spawnSync(CLI[0], args, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, cwd: path.join(__dirname, '..', '..', '..') });
  if (result.status !== 0) throw new Error(`shopify store execute falhou: ${(result.stderr || result.stdout).slice(0, 400)}`);
  const json = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 400));
  return json.data || json;
}

/* Every variant of the store, with what is needed to compare and to update prices */
function allVariants() {
  const nodes = [];
  let after = null;
  for (;;) {
    const data = run(
      `query($after: String) { productVariants(first: 250, after: $after) { nodes { id sku price compareAtPrice inventoryQuantity product { id title status } } pageInfo { hasNextPage endCursor } } }`,
      { after }
    );
    nodes.push(...data.productVariants.nodes);
    if (!data.productVariants.pageInfo.hasNextPage) return nodes;
    after = data.productVariants.pageInfo.endCursor;
  }
}

function updatePrice(productId, variantId, price, compareAtPrice) {
  const data = run(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } } }`,
    { productId, variants: [{ id: variantId, price: String(price), compareAtPrice: compareAtPrice === null ? null : String(compareAtPrice) }] }
  );
  const problems = (data.productVariantsBulkUpdate.userErrors || []).map((error) => error.message).join('; ');
  if (problems) throw new Error(problems);
}

module.exports = { run, allVariants, updatePrice, STORE };
