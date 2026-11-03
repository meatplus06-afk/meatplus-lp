# LP and W2 product identities (2026-11-03)

The failed Auto publish runs were caused by a cross-system identity mismatch,
not an invalid purchase page. The public Food EC master feed returns these
records (productId/productName/productInfo/purchaseUrl):

| LP / master ID | W2 ID | Product | Specification |
| --- | --- | --- | --- |
| i035 | j035 | 創業の味！ちょっと大きな国産生餃子 | 1ｋｇ/ｐ（20ｇ×50個入り） |
| i036 | j036 | 国産ひとくち小粒生餃子 | 650ｇ/ｐ（約13ｇ×50個入り） |

The master-provided full SEO URLs returned HTTP 200. Their canonical links,
`product-detail-form product-id`, product names and specification tables matched
the mapping in `data/storefront-product-identities.json`. Anonymous W2
`/front-api/v1/product/get` requests also confirmed j035/j036 and their product
names. The bare `/product/i035/`, `/product/i036/`, `/product/j035/` and
`/product/j036/` URLs returned error pages/404, so never synthesize those URLs.
Keep the master-provided SEO URLs, including their slug and `+` characters.

The old sitemap check incorrectly assumed every LP ID was also the W2 ID.
The reviewed mapping keeps existing `/products/i035/` and `/products/i036/`
LP addresses and all other products' purchase links. It does not rewrite the
source master or rename records used by other systems.

`storefront-product-identity.mjs` rejects unknown mismatches and restricts the
two reviewed exceptions to their exact verified URLs, product names and sizes.
Before image downloads or page writes, the publisher validates every feed URL
and verifies the mapped products against the live W2 page (canonical, product
ID, title, specification). An HTTP-200 error page or wrong redirect fails closed.
The detailed catalog exposes `storefrontProductId`; W2 price preparation uses it
for API/variant identity while keeping the LP ID for catalog joins. Sitemap and
all product CTAs are checked against the same identity rule.

## Regression verification

- `node --test scripts/test-storefront-product-identity.mjs`: verified aliases,
  unchanged same-ID URLs, UTM removal, swapped products, wrong name/size/ID,
  canonical/redirect failures, HTTP-200 error pages, unsafe hosts and unknown IDs.
- `python3 scripts/test-w2-offers.py`: price/stock/variant checks plus differing
  LP/W2 identity and rejection of the wrong W2 master.
- Isolated full generation using the two public master records and captured live
  product pages, with image requests stubbed: auto-publish, cleanup, discovery,
  entity SEO, commerce, homepage and validation all pass (60 products, 4 guides).
  All 58 preexisting detailed catalog purchase URLs remain identical.
- Production acceptance: run the main-branch Auto publish workflow through Pages
  deployment and check the deployed detailed catalog, CTAs and shop sitemap.
