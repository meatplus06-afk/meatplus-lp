"""Read anonymous W2 storefront data. Never store cookies or request tokens."""
import concurrent.futures
import datetime
import decimal
import html
import http.cookiejar
import json
import pathlib
import re
import urllib.parse
import urllib.request
import unicodedata


def storefront_text(value):
    # W2 sometimes returns display names containing literal Unicode escapes.
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m[1], 16)), str(value or ''))


def verify_selected_variant(row, index, page, final_url):
    url = urllib.parse.urlsplit(final_url)
    expected_path = '/product/' + row['productId'] + '/' + row['item_id'] + '/'
    if url.scheme != 'https' or url.hostname != 'meat-plus.club' or not url.path.endswith(expected_path):
        raise ValueError('Selected variant URL mismatch')
    form = re.search(r'<product-detail-form\b([^>]*)>', page)
    if not form or not re.search(r'product-id="' + re.escape(row['productId']) + r'"', form[1]):
        raise ValueError('Selected product mismatch')
    if not re.search(r'select-variation-index="' + str(index) + r'"', form[1]):
        raise ValueError('Selected option mismatch')
    template = re.search(r'<script[^>]*id="variation-select-dropdown"[^>]*>([\s\S]*?)</script>', page)
    if not template:
        raise ValueError('Option template missing')
    label = re.search(r'<dt\b[^>]*>([\s\S]*?)</dt>', template[1])
    option = re.search(r'<option\b[^>]*value="' + str(index) + r'"[^>]*>([\s\S]*?)</option>', template[1])
    text = lambda s: html.unescape(re.sub(r'<[^>]*>', '', s)).strip()
    if not label or not option:
        raise ValueError('Option label missing')
    comparable = lambda s: re.sub(r'\s+', '', unicodedata.normalize('NFKC', s))
    if not comparable(text(option[1])).startswith(comparable(row['title'])):
        raise ValueError('Option display name mismatch')
    row['url'] = final_url
    row['variant_dict'] = {text(label[1]): row['title']}
    row['variantUrlVerified'] = True
    row.pop('variantUrlReviewRequired', None)


def money(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        amount = decimal.Decimal(str(value))
        return format(amount, 'f') if amount.is_finite() and amount > 0 else None
    except decimal.InvalidOperation:
        return None


def normalize(product, data):
    master = data.get('productMasterInfo', {})
    if master.get('productId') != product['id']:
        raise ValueError('Product ID mismatch')
    variants = data.get('variationList')
    if not isinstance(variants, list) or not variants:
        raise ValueError('No purchasable item data')
    rows = []
    for variant in variants:
        if variant.get('productId') != product['id'] or not variant.get('variationId'):
            raise ValueError('Invalid variant ID')
        prices = variant.get('productPrice', {})
        regular = money(prices.get('regularPrice'))
        normal = money(prices.get('applicableNormalPrice'))
        if not regular or not normal:
            raise ValueError('Missing normal purchase price')
        # hasStock is W2's display decision. stockQuantity can be zero even
        # when inventory control is disabled and the item is purchasable.
        availability = 'unknown'
        if variant.get('hasStock') is False:
            availability = 'out_of_stock'
        elif variant.get('hasStock') is True and variant.get('canPurchase') is True:
            availability = 'in_stock'
        name = variant.get('variationName', {})
        image = variant.get('variationImageUrl', {}).get('lL')
        if not image or 'NowPrinting' in image:
            image = master.get('mainImageUrl', {}).get('lL')
        if not image or 'NowPrinting' in image:
            image = product['image']
        image = urllib.parse.urljoin('https://meatplus06-afk.github.io/meatplus-lp/', image)
        row = {
            'productId': product['id'], 'item_id': variant['variationId'],
            'title': storefront_text(name.get('fullProductNameWithOutParenthesis') or master['productName']),
            'url': product['purchaseUrl'], 'image_url': image,
            'price': regular + ' JPY', 'availability': availability,
            'hasVariations': master.get('hasVariation') is True,
            'variantNames': {key: storefront_text(name[key]) for key in ('name1', 'name2', 'name3') if name.get(key)},
            'canPurchase': variant.get('canPurchase') is True,
            'subscriptionOnly': master.get('isSubscriptionOnly') is True,
        }
        if decimal.Decimal(normal) < decimal.Decimal(regular):
            row['sale_price'] = normal + ' JPY'
        elif decimal.Decimal(normal) > decimal.Decimal(regular):
            row['priceReviewRequired'] = True
        if row['hasVariations']:
            row['variantUrlReviewRequired'] = True
        rows.append(row)
    return rows


def fetch_product(product):
    url = urllib.parse.urlsplit(product['purchaseUrl'])
    if url.scheme != 'https' or url.hostname != 'meat-plus.club':
        raise ValueError('Unexpected storefront URL')
    session = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    session.addheaders = [('User-Agent', 'MEATPLUS-Commerce-Preparation/1.0')]
    with session.open(product['purchaseUrl'], timeout=25) as response:
        if urllib.parse.urlsplit(response.url).hostname != 'meat-plus.club':
            raise ValueError('Unexpected redirect')
        page = response.read().decode('utf-8')
    token = re.search(r'this\.requestVerificationToken\s*=\s*"([^"\r\n]+)"', page)
    if not token:
        raise ValueError('Storefront token not found')
    request = urllib.request.Request(
        'https://meat-plus.club/front-api/v1/product/get',
        data=json.dumps({'ProductId': product['id']}).encode(),
        headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
                 'RequestVerificationToken': token[1]},
    )
    with session.open(request, timeout=25) as response:
        data = json.load(response)
    rows = normalize(product, data)
    for index, row in enumerate(rows):
        if not row['hasVariations']:
            continue
        selected_url = 'https://meat-plus.club/product/detail-redirect/' + urllib.parse.quote(row['productId'], safe='') + '/' + urllib.parse.quote(row['item_id'], safe='')
        try:
            with session.open(selected_url, timeout=25) as response:
                page = response.read().decode('utf-8')
                verify_selected_variant(row, index, page, response.url)
        except Exception:
            # Retain the parent and explicit review flag if verification fails.
            pass
    return rows


def main():
    products = json.loads(pathlib.Path('data/products-detailed.json').read_text())
    rows, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        tasks = {executor.submit(fetch_product, product): product for product in products}
        for task in concurrent.futures.as_completed(tasks):
            product = tasks[task]
            try:
                rows.extend(task.result())
                print('Fetched ' + product['id'], flush=True)
            except Exception as error:
                # Do not log bodies, tokens or cookies; old prices are not reused.
                failures.append({'productId': product['id'], 'reason': type(error).__name__})
                print('Unavailable ' + product['id'] + ': ' + type(error).__name__, flush=True)
    if not rows:
        raise SystemExit('No current storefront data; refusing to replace the snapshot')
    snapshot = {
        'status': 'preparation_only', 'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': 'anonymous W2 storefront product detail API',
        'productCount': len(products), 'fetchedProductCount': len({r['productId'] for r in rows}),
        'itemCount': len(rows), 'failures': sorted(failures, key=lambda r: r['productId']),
        'items': sorted(rows, key=lambda r: (r['productId'], r['item_id'])),
    }
    pathlib.Path('data/w2-offers.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print(f"Current snapshot: {snapshot['fetchedProductCount']}/{len(products)} products, {len(rows)} items")


if __name__ == '__main__':
    main()
