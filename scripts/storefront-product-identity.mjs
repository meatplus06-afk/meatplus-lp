import {readFileSync} from 'node:fs';

const identities = JSON.parse(readFileSync(new URL('../data/storefront-product-identities.json', import.meta.url), 'utf8'));
const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '');
const decode = value => String(value).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export const getStorefrontProductId = id => identities[id]?.storefrontProductId ?? id;

// LP/master IDs and W2 IDs are separate identities. Only reviewed exceptions
// may differ; never infer a shop product from a similar name or numeric suffix.
export function validatePurchaseUrl(id, value, {name, specification} = {}) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new Error('Invalid product ID: ' + id);
  const url = new URL(value);
  if (url.origin !== 'https://meat-plus.club' || url.username || url.password || url.hash)
    throw new Error('Unexpected purchase URL: ' + id);
  for (const key of [...url.searchParams.keys()]) {
    if (!key.startsWith('utm_')) throw new Error('Unexpected purchase URL query: ' + id);
    url.searchParams.delete(key);
  }
  const identity = identities[id];
  if (identity) {
    // Keep the verified SEO URL: bare /product/j035/ and /product/j036/ return 404.
    if (url.href !== identity.purchaseUrl || (name !== undefined && normalize(name) !== normalize(identity.productName)) ||
        (specification !== undefined && normalize(specification) !== normalize(identity.specification)))
      throw new Error('Storefront identity mismatch: ' + id);
  } else if (!url.pathname.endsWith('/product/' + id + '/')) {
    throw new Error('Unverified storefront product ID: ' + id);
  }
  return url.href;
}

export async function verifyMappedStorefront(product, fetchPage = fetch) {
  const id = String(product.productId ?? product.id).toLowerCase();
  if (!identities[id]) return;
  const expected = validatePurchaseUrl(id, product.purchaseUrl, {
    name: product.productName ?? product.name,
    specification: product.productInfo?.['商品規格']
  });
  const response = await fetchPage(expected, {redirect: 'follow'});
  if (!response.ok) throw new Error('Storefront identity request failed: ' + id + ' (' + response.status + ')');
  if (validatePurchaseUrl(id, response.url) !== expected) throw new Error('Storefront redirect mismatch: ' + id);
  const html = await response.text();
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  const shopId = html.match(/<product-detail-form\b[^>]*\bproduct-id="([^"]+)"/i)?.[1];
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const cells = [...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    .map(([, key, value]) => [normalize(decode(key.replace(/<[^>]*>/g, ''))), normalize(decode(value.replace(/<[^>]*>/g, '')))]);
  const identity = identities[id];
  if (!canonical || validatePurchaseUrl(id, decode(canonical)) !== expected || shopId !== identity.storefrontProductId ||
      !normalize(title).startsWith(normalize(identity.productName)) ||
      !cells.some(([key, value]) => key === '商品規格' && value === normalize(identity.specification)))
    throw new Error('Live storefront identity mismatch: ' + id);
}
