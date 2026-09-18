import fs from 'node:fs/promises';
import path from 'node:path';

const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const shop = 'https://meat-plus.club/';
const company = '株式会社MEATPLUS';

const text = value => String(value ?? '').trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');
const categoryLabel = value => text(value).replace(/^[a-z0-9]+[\s　]+/i, '') || 'その他';
const categoryCode = value => (text(value).match(/^([a-z0-9]+)[\s　]+/i) || [])[1]?.toLowerCase() || '';
const knownSlugs = new Map([
  ['牛肉', 'beef'],
  ['豚肉', 'pork'],
  ['鶏肉', 'chicken'],
  ['ラム', 'lamb'],
  ['海鮮・魚介類', 'seafood'],
  ['惣菜・加工品', 'prepared-foods'],
  ['スイーツ・菓子', 'sweets']
]);
const categorySlug = raw => knownSlugs.get(categoryLabel(raw)) || ('category-' + (categoryCode(raw) || 'other'));
const today = new Date().toISOString().slice(0, 10);

const products = JSON.parse(await fs.readFile('data/products-public.json', 'utf8'));
if (!Array.isArray(products)) throw new Error('data/products-public.json must contain an array.');

const publicProductIds = [...new Set(products.map(product => text(product.id).toLowerCase()).filter(Boolean))].sort();
await fs.writeFile(
  'data/products-public.js',
  'window.MEATPLUS_GUIDE_PRODUCT_IDS=' + JSON.stringify(publicProductIds) + ';\n'
);

const groups = new Map();
for (const product of products) {
  const label = categoryLabel(product.category);
  if (!groups.has(label)) groups.set(label, { label, raw: product.category, slug: categorySlug(product.category), products: [] });
  groups.get(label).products.push(product);
}
const categories = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'ja'));

const describedBy = `<link rel="describedby" type="text/plain" href="${site}/llms.txt">`;
const aboutUrl = site + '/about/';

// Home: strengthen non-brand search intent and add crawlable category links.
let index = await fs.readFile('index.html', 'utf8');
if (!index.includes('rel="describedby"')) {
  index = index.replace(/(<link rel="canonical" href="[^"]+">)/, `$1${describedBy}`);
}
index = index.replace(
  /<title>MEAT PLUS公式商品ガイド｜お肉・食品のお取り寄せ<\/title>/,
  '<title>黒毛和牛・肉・食品の通販情報｜MEAT PLUS公式商品ガイド</title>'
);
index = index.replace(
  /<meta name="description" content="MEAT PLUSの黒毛和牛、精肉、冷凍食品などの商品情報、原材料、食べ方を紹介する公式商品ガイドです。">/,
  '<meta name="description" content="MEAT PLUSの黒毛和牛・牛肉、もつ鍋・水炊きなどの惣菜、海鮮、食品を探せる公式商品ガイド。特徴、内容量、保存方法、食べ方、FAQ、公式通販への購入先を確認できます。">'
);
index = index.replace(
  /<h1>今夜の「おいしい」が、<br>ここで見つかる。<\/h1>/,
  '<h1>黒毛和牛・肉・食品を、<br>公式情報から探す。</h1>'
);
const categoryNav = `<nav class="section-nav" data-discovery-categories aria-label="商品カテゴリ"><a href="${aboutUrl}">このガイドについて</a>${categories.map(category => `<a href="${site}/categories/${esc(category.slug)}/">${esc(category.label)}</a>`).join('')}</nav>`;
if (!index.includes('data-discovery-categories')) {
  index = index.replace('<section class="catalog" id="catalog">', categoryNav + '<section class="catalog" id="catalog">');
}
index = index.replace(
  /<footer><a href="https:\/\/meat-plus\.club\/">MEAT PLUS公式オンラインショップ<\/a><small>© MEAT PLUS<\/small><\/footer>/,
  `<footer><a href="${shop}">MEAT PLUS公式オンラインショップ</a><a href="${aboutUrl}">運営者・情報更新方針</a><small>© MEAT PLUS</small></footer>`
);
await fs.writeFile('index.html', index);

// Product pages: reinforce provenance and AI/search discovery while preserving product content.
for (const product of products) {
  const id = text(product.id).toLowerCase();
  if (!id) continue;
  const pagePath = path.join('products', id, 'index.html');
  let page;
  try { page = await fs.readFile(pagePath, 'utf8'); } catch { continue; }
  const canonical = text(product.url) || `${site}/products/${id}/`;
  const label = categoryLabel(product.category);
  const slug = categorySlug(product.category);
  const updated = text(product.updatedAt);
  const title = text(product.name);

  if (!page.includes('rel="describedby"')) {
    page = page.replace(/(<link rel="canonical" href="[^"]+">)/, `$1${describedBy}<link rel="up" href="${site}/">`);
  }
  page = page.replace(
    new RegExp(`<title>${title.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}｜MEAT PLUS公式商品ガイド<\\/title>`),
    `<title>${esc(title)}｜商品情報・公式通販｜MEAT PLUS</title>`
  );
  if (!page.includes('id="discovery-webpage-schema"')) {
    const webPageLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': canonical + '#webpage',
      url: canonical,
      name: title,
      isPartOf: { '@id': site + '/#website' },
      publisher: { '@id': shop + '#organization' },
      mainEntity: { '@id': canonical + '#product' },
      inLanguage: 'ja',
      ...(updated ? { dateModified: updated } : {})
    };
    page = page.replace('</head>', `<script id="discovery-webpage-schema" type="application/ld+json">${jsonLd(webPageLd)}</script></head>`);
  }
  page = page.replace(
    /<footer><a href="https:\/\/meat-plus\.club\/">MEAT PLUS公式オンラインショップ<\/a><small>商品ID：([^<]+)<\/small><\/footer>/,
    `<footer><a href="${shop}">MEAT PLUS公式オンラインショップ</a><a href="${site}/categories/${esc(slug)}/">${esc(label)}の商品一覧</a><a href="${aboutUrl}">情報提供元：${company}</a><small>商品ID：$1${updated ? `　最終更新：${esc(updated.slice(0, 10))}` : ''}</small></footer>`
  );
  await fs.writeFile(pagePath, page);
}

// Category landing pages: crawlable, indexable entry points for non-brand searches.
for (const category of categories) {
  const dir = path.join('categories', category.slug);
  await fs.mkdir(dir, { recursive: true });
  const names = category.products.slice(0, 5).map(product => text(product.name)).filter(Boolean);
  const examples = names.length ? names.join('、') + 'など' : category.label + 'の商品';
  const description = `MEAT PLUSが取り扱う${category.label}の公式商品情報です。${examples}の特徴、保存方法、商品情報、公式通販への購入先を確認できます。`;
  const categoryUrl = `${site}/categories/${category.slug}/`;
  const cards = category.products.map(product => `<a class="card" href="${esc(product.url)}"><img src="${esc(product.image)}" alt="${esc(product.name)}" width="800" height="800" loading="lazy"><div><p class="eyebrow">${esc(category.label)}</p><h3>${esc(product.name)}</h3><p class="card-description">${esc(product.description)}</p><span class="text-link">商品情報を見る →</span></div></a>`).join('\n');
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': categoryUrl + '#webpage',
        url: categoryUrl,
        name: `${category.label}の商品一覧・通販情報`,
        description,
        isPartOf: { '@id': site + '/#website' },
        publisher: { '@id': shop + '#organization' },
        inLanguage: 'ja'
      },
      {
        '@type': 'ItemList',
        name: `${category.label}の商品一覧`,
        numberOfItems: category.products.length,
        itemListElement: category.products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: product.url, name: product.name }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'MEAT PLUS公式商品ガイド', item: site + '/' },
          { '@type': 'ListItem', position: 2, name: category.label, item: categoryUrl }
        ]
      }
    ]
  };
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(category.label)}の商品一覧・通販情報｜MEAT PLUS公式商品ガイド</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${categoryUrl}">${describedBy}<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="MEAT PLUS公式商品ガイド"><meta property="og:title" content="${esc(category.label)}の商品一覧・通販情報"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${categoryUrl}"><script type="application/ld+json">${jsonLd(schema)}</script><link rel="stylesheet" href="../../assets/style.css"></head><body><header class="site-header"><a class="brand" href="${site}/">MEAT PLUS</a><span>商品ガイド</span></header><main><nav class="breadcrumb"><a href="${site}/">商品ガイド</a><span>／</span><span>${esc(category.label)}</span></nav><section class="hero"><p class="eyebrow">MEAT PLUS OFFICIAL GUIDE</p><h1>${esc(category.label)}の商品を探す</h1><p>${esc(description)}</p></section><section class="catalog"><div class="catalog-heading"><div><p class="eyebrow">${esc(category.label)}</p><h2>${category.products.length}商品を掲載</h2></div><p>気になる商品を選ぶと、内容量・保存方法・食べ方・公式購入先などを確認できます。</p></div><div class="catalog-grid">${cards}</div></section></main><footer><a href="${site}/">商品ガイドTOP</a><a href="${shop}">MEAT PLUS公式オンラインショップ</a><a href="${aboutUrl}">運営者・情報更新方針</a><small>© MEAT PLUS</small></footer></body></html>`;
  await fs.writeFile(path.join(dir, 'index.html'), html);
}

// About/provenance page for search engines and answer engines.
await fs.mkdir('about', { recursive: true });
const aboutDescription = 'MEAT PLUS公式商品ガイドの運営者、掲載内容、情報更新方針、公式情報源についてご案内します。';
const aboutSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'AboutPage', '@id': aboutUrl + '#webpage', url: aboutUrl, name: 'MEAT PLUS公式商品ガイドについて', description: aboutDescription, isPartOf: { '@id': site + '/#website' }, about: { '@id': shop + '#organization' }, inLanguage: 'ja' },
    { '@type': 'Organization', '@id': shop + '#organization', name: company, alternateName: 'MEAT PLUS', url: shop }
  ]
};
const aboutHtml = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEAT PLUS公式商品ガイドについて｜運営者・情報更新方針</title><meta name="description" content="${aboutDescription}"><link rel="canonical" href="${aboutUrl}">${describedBy}<meta name="robots" content="index,follow,max-snippet:-1"><script type="application/ld+json">${jsonLd(aboutSchema)}</script><link rel="stylesheet" href="../assets/style.css"></head><body><header class="site-header"><a class="brand" href="${site}/">MEAT PLUS</a><span>商品ガイド</span></header><main><nav class="breadcrumb"><a href="${site}/">商品ガイド</a><span>／</span><span>このガイドについて</span></nav><section class="hero"><p class="eyebrow">ABOUT THIS GUIDE</p><h1>MEAT PLUS公式商品ガイドについて</h1><p>このサイトは${company}が運営する、商品を探す方・購入前に調べる方のための公式商品情報ガイドです。</p></section><section class="info"><div><p class="eyebrow">OFFICIAL SOURCE</p><h2>掲載している情報</h2></div><dl><dt>運営者</dt><dd>${company}</dd><dt>掲載内容</dt><dd>商品名、特徴、内容量・規格、保存方法、原材料、FAQ、画像、公式購入先など、登録された商品情報をもとに掲載します。</dd><dt>更新方針</dt><dd>商品データの更新に合わせて商品ページ・商品一覧・サイトマップを更新します。</dd><dt>価格・在庫</dt><dd>最新の価格、在庫、配送条件はMEAT PLUS公式オンラインショップの表示を最終確認してください。</dd></dl></section><section class="closing"><p class="eyebrow">MACHINE-READABLE SOURCES</p><h2>検索・AI向けの公式情報源</h2><p>商品ページに加えて、サイトマップ、公開商品JSON、llms.txtを公開しています。</p><a class="text-link" href="${site}/sitemap.xml">サイトマップ</a>　<a class="text-link" href="${site}/data/products-public.json">公開商品JSON</a>　<a class="text-link" href="${site}/llms.txt">llms.txt</a></section></main><footer><a href="${site}/">商品ガイドTOP</a><a href="${shop}">MEAT PLUS公式オンラインショップ</a><small>© MEAT PLUS</small></footer></body></html>`;
await fs.writeFile('about/index.html', aboutHtml);

// Rebuild sitemap with products plus discovery pages.
const urlEntries = [
  `<url><loc>${site}/</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>`,
  `<url><loc>${aboutUrl}</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>`,
  ...categories.map(category => `<url><loc>${site}/categories/${esc(category.slug)}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`),
  ...products.map(product => `<url><loc>${esc(product.url)}</loc><lastmod>${text(product.updatedAt).slice(0,10) || today}</lastmod><priority>1.0</priority><image:image><image:loc>${esc(product.image)}</image:loc><image:title>${esc(product.name)}</image:title></image:image></url>`)
];
await fs.writeFile('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + urlEntries.join('\n') + '\n</urlset>\n');

// Explicitly expose the site to search/answer crawlers while retaining the general allow rule.
await fs.writeFile('robots.txt', `User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);

const llms = [
  '# MEAT PLUS公式商品ガイド',
  '',
  `> ${company}が運営する公式商品情報サイト。黒毛和牛・肉・食品を探す方、購入前に調べる方のために、商品名、特徴、規格、保存方法、原材料、FAQ、公式購入先を整理しています。`,
  '',
  '## 公式情報源',
  `- [商品ガイドTOP](${site}/)`,
  `- [運営者・情報更新方針](${aboutUrl})`,
  `- [公開商品データ(JSON)](${site}/data/products-public.json)`,
  `- [サイトマップ](${site}/sitemap.xml)`,
  `- [詳細版 llms-full.txt](${site}/llms-full.txt)`,
  `- [公式オンラインショップ](${shop})`,
  '',
  '## カテゴリ',
  ...categories.map(category => `- [${category.label}](${site}/categories/${category.slug}/): ${category.products.length}商品`),
  '',
  '## 商品ページ',
  ...products.map(product => `- [${text(product.name)}](${text(product.url)}): ${text(product.description).replace(/\s+/g, ' ').slice(0, 220)}`),
  '',
  '商品情報を引用・参照する場合は、各商品ページとMEAT PLUS公式オンラインショップの最新表示を確認してください。'
];
await fs.writeFile('llms.txt', llms.join('\n') + '\n');

const llmsFull = [
  '# MEAT PLUS公式商品ガイド - Full Catalog',
  '',
  `運営者: ${company}`,
  `公式オンラインショップ: ${shop}`,
  `商品ガイド: ${site}/`,
  `更新日: ${today}`,
  '',
  'このファイルは検索エージェント・AIエージェントが公式商品ページを発見しやすいよう、公開商品情報をテキスト形式でまとめたものです。価格・在庫・配送条件は公式オンラインショップを最終確認してください。',
  '',
  ...products.flatMap(product => [
    `## ${text(product.name)} (${text(product.id).toUpperCase()})`,
    `- URL: ${text(product.url)}`,
    `- カテゴリ: ${categoryLabel(product.category)}`,
    `- 概要: ${text(product.description).replace(/\s+/g, ' ')}`,
    `- 画像: ${text(product.image)}`,
    `- 最終更新: ${text(product.updatedAt) || '不明'}`,
    ''
  ])
];
await fs.writeFile('llms-full.txt', llmsFull.join('\n') + '\n');

console.log(`Discovery build complete: ${products.length} products, ${categories.length} category pages.`);
