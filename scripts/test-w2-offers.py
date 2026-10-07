import importlib.util
import unittest

spec = importlib.util.spec_from_file_location('offers', 'scripts/fetch-w2-offers.py')
offers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offers)


class OfferTests(unittest.TestCase):
    def row(self, **overrides):
        product = {'id': 'm002', 'purchaseUrl': 'https://meat-plus.club/product/m002/', 'image': './assets/products/m002.jpg'}
        variant = {'productId': 'm002', 'variationId': 'm002', 'productPrice': {
            'regularPrice': 10800, 'applicableNormalPrice': 8800, 'subscriptionPrice': 8360},
            'stockQuantity': 0, 'hasStock': True, 'canPurchase': True}
        variant.update(overrides)
        return offers.normalize(product, {'productMasterInfo': {'productId': 'm002', 'productName': '焼肉セット'}, 'variationList': [variant]})[0]

    def test_normal_price_excludes_subscription(self):
        row = self.row()
        self.assertEqual(row['price'], '10800 JPY')
        self.assertEqual(row['sale_price'], '8800 JPY')
        self.assertEqual(row['availability'], 'in_stock')

    def test_stock_decision_and_disabled_purchase(self):
        self.assertEqual(self.row(hasStock=False)['availability'], 'out_of_stock')
        self.assertEqual(self.row(canPurchase=False)['availability'], 'unknown')

    def test_equal_price_has_no_sale(self):
        row = self.row(productPrice={'regularPrice': 1000, 'applicableNormalPrice': 1000})
        self.assertNotIn('sale_price', row)

    def test_invalid_price_and_wrong_product_fail(self):
        with self.assertRaises(ValueError):
            self.row(productPrice={'regularPrice': None, 'applicableNormalPrice': 8360})
        with self.assertRaises(ValueError):
            self.row(productId='another')
        for value in (None, 0, -1, True, 'NaN', 'Infinity'):
            self.assertIsNone(offers.money(value))

    def test_selected_variant_requires_matching_route_index_and_name(self):
        row = {'productId': 'a003', 'item_id': 'a003001', 'title': '和牛 400g', 'variantUrlReviewRequired': True}
        page = '<product-detail-form product-id="a003" select-variation-index="0"></product-detail-form><script id="variation-select-dropdown"><dt>商品選択</dt><option value="0">和牛&#x3000;400ｇ</option></script>'
        url = 'https://meat-plus.club/和牛/product/a003/a003001/'
        offers.verify_selected_variant(row, 0, page, url)
        self.assertEqual(row['variant_dict'], {'商品選択': '和牛 400g'})
        self.assertTrue(row['variantUrlVerified'])
        self.assertNotIn('variantUrlReviewRequired', row)
        for wrong_page, wrong_url in ((page.replace('index="0"', 'index="1"'), url), (page.replace('400ｇ', '500ｇ'), url), (page, url.replace('a003001', 'a003002')), (page, url.replace('meat-plus.club', 'example.com'))):
            with self.assertRaises(ValueError):
                offers.verify_selected_variant(row, 0, wrong_page, wrong_url)

    def test_storefront_unicode_display_name(self):
        self.assertEqual(offers.storefront_text(r'和牛\u3000400g'), '和牛　400g')


if __name__ == '__main__':
    unittest.main()
