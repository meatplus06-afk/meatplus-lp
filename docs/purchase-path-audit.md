# Purchase path audit, 2026-10-07

The public W2 m002 product page links its shipping-details text to `./`,
which resolves to the product itself. The actual shipping guide is
`https://meat-plus.club/page/guide#shipping`. The product page also says
shipping varies by region, while the guide lists flat rates. Do not copy
either statement into additional pages until the store policy is reconciled.

W2 administration could not be opened in this browser (authentication
failure). No admin setting, checkout, price, order, or template was changed.

The guide now links each product's main CTA area directly to the official
shipping guide. It does not promise a shipping price or delivery date.
Unverified `Product.brand` and `Product.manufacturer` values are removed
from guide schema; the site publisher remains identified as MEAT PLUS.

GA4 event instrumentation added:

- `product_select`: homepage hero/catalog product selection, product ID.
- `product_guide_view`: product guide view, product ID.
- `shipping_info_click`: shipping guide link selection, product ID.
- `shop_button_click`: homepage shop link, attribution parameters.
- Existing `guide_select`, `guide_product_click`, `purchase_button_click`
  remain in place. The shared script reuses existing gtag initialization.

These are guide events, not completed purchases. GA4 receipt, cross-domain
identity, W2 add-to-cart, checkout, and purchase-event reporting still need
verification in the store's analytics/admin. Do not report conversions or
sales improvement merely because click instrumentation works.

Remaining W2 work when authenticated administration is available:

1. Fix the shipping link and reconcile flat-rate/region wording.
2. Confirm product brands and actual manufacturers item by item.
3. Verify mobile option selection, regular/subscription distinction,
   checkout, cross-domain analytics and completed-purchase events.
