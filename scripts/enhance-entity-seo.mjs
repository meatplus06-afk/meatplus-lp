import fs from 'node:fs/promises';
import path from 'node:path';

const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const shop = 'https://meat-plus.club/';
const company = '株式会社MEATPLUS';
const logo = 'https://meat-plus.club/assets/img/common/logo.png';
const sameAs = [
  'https://www.meatplus.jp/company',
  'https://www.instagram.com/meat_plus.official/',
  'https://www.youtube.com/channel/UCrUpCUTB83gU64EtZGeyo_A'
];

const org = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': shop + '#organization',
  name: company,
  alternateName: 'MEAT PLUS',
  url: shop,
  logo: { '@type': 'ImageObject', url: logo },
  sameAs
};

const categoryGuides = {
  beef: {
    title: '牛肉を選ぶときに確認したいポイント',
    body: 'MEAT PLUS公式商品ガイドでは、九州産黒毛和牛のスライス、切り落とし、ブロックなどを掲載しています。商品ごとに規格、保存方法、原産国・製造地、原材料、FAQ、公式オンラインショップの購入先を確認できます。すき焼き、しゃぶしゃぶ、焼肉、ローストビーフなど、使いたい料理や肉の形状から比較する際にご利用ください。'
  },
  'prepared-foods': {
    title: '惣菜・加工品を探している方へ',
    body: 'もつ鍋、水炊き、カレー、炭火焼、焼餅、骨付きフランクなど、家庭で使いやすい惣菜・加工品の公式情報をまとめています。各商品ページでは内容量、保存方法、原材料、調理方法やFAQ、公式オンラインショップの購入先を確認できます。味の種類や調理方法、保存方法を比較しながら商品を探せます。'
  },
  seafood: {
    title: '海鮮・魚介類の商品情報',
    body: 'アジフライ、うなぎ、子持ちやりいか、辛子明太子、タコチャンジャ、にしん甘酢漬などの公式商品情報を掲載しています。原材料、保存方法、商品規格、食べ方に関するFAQ、公式オンラインショップの購入先を商品ごとに確認できます。購入前の比較や、食べ方・保存方法を調べる際にご利用ください。'
  },
  sweets: {
    title: 'おやつ・間食向けの商品を探す',
    body: '梅菓子、こんにゃくゼリー、ナッツや小魚を使った商品など、手軽に楽しめる商品の公式情報をまとめています。商品ページでは規格、保存方法、原材料、FAQ、公式オンラインショップの購入先を確認できます。商品の特徴や内容量を比較して選ぶ際にご利用ください。'
  }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq = values => [...new Set(values.filter(Boolean))];

const patchEntity = value => {
  if (Array.isArray(value)) return value.map(patchEntity);
  if (!value || typeof value !== 'object') return value;

  for (const [key, child] of Object.entries(value)) value[key] = patchEntity(child);

  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Organization')) {
    value.logo = value.logo || { '@type': 'ImageObject', url: logo };
    value.sameAs = uniq([...(Array.isArray(value.sameAs) ? value.sameAs : value.sameAs ? [value.sameAs] : []), ...sameAs]);
    if (value['@id'] === shop + '#organization' || value.url === shop || value.name === company) {
      value['@id'] = shop + '#organization';
      value.name = value.name || company;
      value.alternateName = value.alternateName || 'MEAT PLUS';
      value.url = value.url || shop;
    }
  }
  if (types.includes('Product') && value.manufacturer && typeof value.manufacturer === 'object') {
    value.manufacturer.logo = value.manufacturer.logo || { '@type': 'ImageObject', url: logo };
    value.manufacturer.sameAs = uniq([...(Array.isArray(value.manufacturer.sameAs) ? value.manufacturer.sameAs : []), ...sameAs]);
  }
  return value;
};

const patchJsonLd = html => html.replace(
  /<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g,
  (full, attrs, raw) => {
    try {
      const parsed = patchEntity(JSON.parse(raw));
      return '<script' + attrs + '>' + JSON.stringify(parsed).replace(/</g, '\\u003c') + '</script>';
    } catch {
      return full;
    }
  }
);

const pagePaths = ['index.html'];
for (const root of ['products', 'categories', 'about']) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(root, entry.name, 'index.html');
      try {
        await fs.access(candidate);
        pagePaths.push(candidate);
      } catch {}
    }
  } catch {}
}

for (const pagePath of pagePaths) {
  let html = await fs.readFile(pagePath, 'utf8');
  html = patchJsonLd(html);

  if (!html.includes('rel="icon"')) {
    html = html.replace('</head>', '<link rel="icon" type="image/png" href="' + logo + '"><link rel="apple-touch-icon" href="' + logo + '"></head>');
  }
  if (!html.includes('name="publisher"')) {
    html = html.replace('</head>', '<meta name="publisher" content="' + company + '"></head>');
  }
  if (!html.includes('rel="author"') && pagePath !== 'about/index.html') {
    html = html.replace('</head>', '<link rel="author" href="' + site + '/about/"></head>');
  }
  if (!html.includes('id="enhanced-organization-schema"')) {
    html = html.replace('</head>', '<script id="enhanced-organization-schema" type="application/ld+json">' + JSON.stringify(org).replace(/</g, '\\u003c') + '</script></head>');
  }

  const match = pagePath.match(/^categories\/([^/]+)\/index\.html$/);
  if (match && !html.includes('data-category-search-guide')) {
    const guide = categoryGuides[match[1]];
    if (guide) {
      const section = '<section class="closing" data-category-search-guide><p class="eyebrow">SEARCH GUIDE</p><h2>' + esc(guide.title) + '</h2><p>' + esc(guide.body) + '</p><p><a class="text-link" href="' + site + '/about/">MEAT PLUS公式商品ガイドについて →</a></p></section>';
      html = html.replace('</main>', section + '</main>');
    }
  }

  await fs.writeFile(pagePath, html);
}

console.log('Enhanced entity provenance, favicon and category search content on', pagePaths.length, 'page(s).');
