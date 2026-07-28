# Food EC Master → LP feed

GitHub Actions reads one public, read-only JSON endpoint. The endpoint exposes only products whose LP button has been pressed and which are waiting for publication. Never expose Drive IDs, user data, supplier data, cost data, GPT action tokens, API keys, or unrelated product records.

## Response

```json
{
  "updatedAt": "2026-07-28T00:00:00+09:00",
  "products": [
    {
      "productId": "k003",
      "productName": "ミックスビーンズ",
      "category": "豆菓子・おつまみ",
      "purchaseUrl": "https://meat-plus.club/product/detail/k003",
      "visualLabel": "MIXED BEANS / 270g",
      "catchCopy": "カリッ、ぽりっ。一口ごとに変わる味と食感。",
      "description": "商品説明",
      "metaDescription": "検索結果用説明",
      "cardDescription": "一覧カード用説明",
      "closingCopy": "おやつにも、晩酌にも。",
      "ingredients": "原材料表示",
      "images": {
        "productList": {"name": "product.jpg", "mimeType": "image/jpeg", "base64": "..."},
        "sns1": {"name": "sns1.jpg", "mimeType": "image/jpeg", "base64": "..."},
        "sns2": {"name": "sns2.jpg", "mimeType": "image/jpeg", "base64": "..."},
        "sns3": {"name": "sns3.jpg", "mimeType": "image/jpeg", "base64": "..."}
      },
      "sceneCopies": ["訴求1", "訴求2", "訴求3"],
      "productInfo": {
        "商品名": "ミックスビーンズ",
        "内容量": "270g",
        "保存方法": "常温"
      },
      "faq": [
        {"question": "質問", "answer": "回答"}
      ],
      "updatedAt": "2026-07-28T00:00:00+09:00"
    }
  ]
}
```

## Image selection

- `productList`: product-list image stored during product registration; filename is irrelevant.
- `sns1`, `sns2`, `sns3`: select by filename, case-insensitive.
- Ignore every other uploaded image.
- Missing SNS images are omitted without empty frames.
- Images are transferred only for the pending product, then stored in the public repository.

## Publication

- Workflow: `.github/workflows/sync-products.yml`
- Generator: `scripts/sync-lp.mjs`
- Schedule: once per day at 03:17 JST and manual execution
- No data change means no commit or redeployment.
- Published LPs are not regenerated. A saved product edit clears its publication state, allowing a replacement LP to be published to the same URL.
