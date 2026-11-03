import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePurchaseUrl, verifyMappedStorefront, getStorefrontProductId} from './storefront-product-identity.mjs';

const identities = JSON.parse(readFileSync(new URL('../data/storefront-product-identities.json', import.meta.url)));
const fixture = (id, changes = {}) => {
  const row = identities[id];
  const html = `<title>${row.productName}｜MEAT PLUS公式</title><link rel="canonical" href="${row.purchaseUrl}">
    <product-detail-form product-id="${row.storefrontProductId}"></product-detail-form>
    <table><tr><th>商品規格</th><td>${row.specification}</td></tr></table>`;
  return {ok: true, status: 200, url: row.purchaseUrl, text: async () => html, ...changes};
};
const product = id => ({productId: id, productName: identities[id].productName,
  purchaseUrl: identities[id].purchaseUrl, productInfo: {'商品規格': identities[id].specification}});

for (const [id, row] of Object.entries(identities)) {
  test(`${id} uses the reviewed W2 identity and preserves the working SEO URL`, async () => {
    assert.equal(getStorefrontProductId(id), row.storefrontProductId);
    assert.equal(validatePurchaseUrl(id, row.purchaseUrl), row.purchaseUrl);
    await verifyMappedStorefront(product(id), async () => fixture(id));
    // W2 encodes + as a hexadecimal HTML entity in canonical links.
    const original = await fixture(id).text();
    await verifyMappedStorefront(product(id), async () => fixture(id, {text: async () => original.replaceAll('+', '&#x2B;')}));
    assert.throws(() => validatePurchaseUrl(id, `https://meat-plus.club/product/${id}/`));
    assert.throws(() => validatePurchaseUrl(id, `https://meat-plus.club/product/${row.storefrontProductId}/`));
  });

  test(`${id} rejects a different product name, size, canonical, form identity or redirect`, async () => {
    const p = product(id), original = await fixture(id).text();
    assert.throws(() => validatePurchaseUrl(id, p.purchaseUrl, {name: '別の商品'}));
    assert.throws(() => validatePurchaseUrl(id, p.purchaseUrl, {specification: '別の規格'}));
    for (const html of [original.replace(row.storefrontProductId + '"', 'other"'),
      original.replace(row.specification, '500g'), original.replace(row.productName, '別の商品'),
      original.replace('rel="canonical"', 'rel="alternate"'), '<title>エラー</title>']) {
      await assert.rejects(verifyMappedStorefront(p, async () => fixture(id, {text: async () => html})));
    }
    await assert.rejects(verifyMappedStorefront(p, async () => fixture(id, {url: 'https://example.com/'})));
    await assert.rejects(verifyMappedStorefront(p, async () => fixture(id, {ok: false, status: 404})));
  });
}

test('existing same-ID purchase URLs retain their SEO path and strip only UTM parameters', () => {
  const url = 'https://meat-plus.club/和牛/product/m002/';
  assert.equal(validatePurchaseUrl('m002', url), new URL(url).href);
  assert.equal(validatePurchaseUrl('m002', url + '?utm_source=github_pages&utm_content=main'), new URL(url).href);
  assert.equal(getStorefrontProductId('m002'), 'm002');
});

test('unknown mismatches, variants and unsafe URLs still fail closed', () => {
  for (const url of ['https://meat-plus.club/product/j037/', 'http://meat-plus.club/product/i037/',
    'https://meat-plus.club.evil.test/product/i037/', 'https://meat-plus.club:444/product/i037/',
    'https://user:pass@meat-plus.club/product/i037/', 'https://meat-plus.club/product/i037/?redirect=other',
    'https://meat-plus.club/product/i037/#other', 'https://meat-plus.club/product/i037/i037001/']) {
    assert.throws(() => validatePurchaseUrl('i037', url));
  }
  assert.throws(() => validatePurchaseUrl('i035', identities.i036.purchaseUrl));
  assert.throws(() => validatePurchaseUrl('i036', identities.i035.purchaseUrl));
});
