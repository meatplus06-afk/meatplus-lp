# 商品ガイドの検索・送客計測

## 2026-11-04の確認・実施

- 接続済みのGoogle公式管理画面からSearch ConsoleとGA4を確認した。外部分析サービスの追加契約は行っていない。
- LP用sitemap.xmlとW2用w2-sitemap.xmlを、LPの正しいURLプレフィックスのSearch Consoleプロパティから再送信。送信受付とGoogleの読み取り成功・インデックス完了は別として扱う。再送信後も読み取り失敗の表示が残るため、修正完了とは記録しない。
- 公開sitemap.xmlはHTTP 200/application-xmlで75 URL、w2-sitemap.xmlはHTTP 200/application-xmlで61 URL。XML構文解析が成功した。
- articles/nabe-set-or-soup/ はGoogleライブテストでインデックス登録可能と判定された。
- articles/nabe-set-or-soup/、articles/meat-gift-checklist/、articles/sukiyaki-choose/ の3件で登録リクエストが受理され、優先クロールキューへの追加を確認。登録完了・検索結果掲載とは扱わない。
- LPとW2で利用している既存測定IDと、GA4データストリームの測定IDの一致を確認。ストリームの表示URLは旧ドメインだが、現在のデータフローを確認した。URL表示だけからデータ欠損と断定せず、ホスト名で対象サイトを絞る。
- GA4の最近のイベントでpurchase_button_click、product_guide_view、guide_product_click、guide_select、product_select、shipping_info_click、purchaseを確認。
- 以下4件をイベントスコープのカスタムディメンションとして登録し、保存後の一覧で確認した。既存定義・キーイベント・広告アトリビューション設定は変更しない。

| 表示名 | イベントパラメータ | 用途 |
| --- | --- | --- |
| 商品ガイド_記事種別 | article_type | 記事slug別に閲覧・送客を調べる |
| 商品ガイド_商品ID | product_id | 商品別に閲覧・送客を調べる |
| 商品ガイド_用途 | guide_type | 用途別ガイドの利用状況を調べる |
| 商品ガイド_導線位置 | cta_position | ボタン・商品リンクの位置を調べる |

## 集計を誤らないためのルール

1. 検索の公開状態は、HTTP取得、Googleライブテスト、サイトマップ処理、インデックス登録、検索表示・クリックを区別する。レポートの最終更新日を必ず併記する。
2. GA4の既存プロパティには複数ホストのアクセスが含まれ得る。LPの閲覧とW2側の到着・購入を混同しない。
3. LPからW2への到着は、W2のホスト名とセッション参照元/メディアgithub_pages/referral、キャンペーンguide_*、article_*などの組み合わせで確認する。product_guideだけをLP経由売上とみなさない。
4. purchase_button_clickは送客クリックであり、purchaseは購入完了イベント。計測された売上と受注実績が一致するかの照合は別途必要。未計測の購入をゼロと断定しない。
5. AI Assistantという分類には複数の参照元が含まれ得る。ChatGPTの実績と呼ぶときはchatgpt.com等の参照元まで確認する。
6. 自分や検証操作のアクセスが混ざる可能性を明記する。少数の観測を市場シェアや推薦率として扱わない。
7. 新しいカスタムディメンションの登録は、過去データの復元や即時集計を保証しない。

非公開の流入数・収益の数値は、この公開リポジトリには記載しない。
