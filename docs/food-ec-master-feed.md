# Food EC Master → LP feed

GitHub Actions reads one public, read-only JSON endpoint. The endpoint must expose only products approved for public LP publication. Never expose Drive IDs, user data, GPT action tokens, API keys, or unpublished product records.

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
      "lpPublished": true,
      "visualLabel": "MIXED BEANS / 270g",
      "catchCopy": "カリッ、ぽりっ。一口ごとに変わる味と食感。",
      "description": "商品説明",
      "metaDescription": "検索結果用説明",
      "cardDescription": "一覧カード用説明",
      "closingCopy": "おやつにも、晩酌にも。",
      "ingredients": "原材料表示",
      "images": {
        "productList": "https://.../public-image",
        "sns1": "https://.../public-image",
        "sns2": "https://.../public-image",
        "sns3": "https://.../public-image"
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
- Image responses must be directly downloadable without a Google login page.

## Publication

- Workflow: `.github/workflows/sync-products.yml`
- Generator: `scripts/sync-lp.mjs`
- Secret: `FOOD_EC_MASTER_FEED_URL`
- Schedule: once per hour and manual execution
- No data change means no commit or redeployment.
