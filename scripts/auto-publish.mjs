import fs from 'node:fs/promises';
import path from 'node:path';

const feedUrl = process.env.LP_FEED_URL;
const site = 'https://meatplus06-afk.github.io/meatplus-lp';
if (!feedUrl) throw new Error('LP_FEED_URL is required');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = value => String(value ?? '').trim();
const validId = value => /^[a-z0-9][a-z0-9_-]*$/i.test(value);
const stripQuery = value => text(value).split('?')[0];
const extFrom = (contentType, url) => {
  const type = (contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  const m = stripQuery(url).match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : 'jpg';
};
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');

const response = await fetch(feedUrl + '?action=github-lp-feed', {
  method: 'POST',
  headers: {'content-type':'application/x-www-form-urlencoded'},
  body: 'action=github-lp-feed',
  redirect: 'follow'
});
if (!response.ok) throw new Error('Feed request failed: ' + response.status);
const payload = await response.json();
const products = Array.isArray(payload.products) ? payload.products : [];
if (!products.length) process.exit(0);

let catalog = [];
try { catalog = JSON.parse(await fs.readFile('data/products.json','utf8')); } catch {}
if (!Array.isArray(catalog)) catalog = [];

const downloadImages = async product => {
  const id = text(product.productId).toLowerCase();
  const output = {};
  const dir = path.join('assets','products',id);
  await fs.mkdir(dir,{recursive:true});
  for (const role of ['productList','sns1','sns2','sns3']) {
    const url = text(product.images?.[role]?.url);
    if (!url) continue;
    const r = await fetch(url,{redirect:'follow'});
    if (!r.ok) throw new Error(id + ': image download failed for ' + role + ' (' + r.status + ')');
    const ext = extFrom(r.headers.get('content-type'), url);
    const filename = role === 'productList' ? 'product-list.' + ext : role + '.' + ext;
    await fs.writeFile(path.join(dir,filename), Buffer.from(await r.arrayBuffer()));
    output[role] = filename;
  }
  if (!output.productList) throw new Error(id + ': productList image is required');
  return output;
};

const render = (p, images) => {
  const id=text(p.productId).toLowerCase(), name=text(p.productName), category=text(p.category);
  const description=text(p.description), meta=text(p.metaDescription)||description||name;
  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;
  const purchase=text(p.purchaseUrl), queued=text(p.updatedAt);
  if (!validId(id) || !name || !/^https?:\/\//i.test(purchase)) throw new Error(id+': required data is missing');
  const imageUrls=Object.values(images).map(f => site+'/assets/products/'+id+'/'+f);
  const faq=(Array.isArray(p.faq)?p.faq:[]).map(x=>({q:text(x.question||x.q),a:text(x.answer||x.a)})).filter(x=>x.q&&x.a);
  const info=Object.entries(p.productInfo||{}).filter(([,v])=>text(v));
  const img = role => images[role] ? '../../assets/products/'+id+'/'+images[role] : '';
  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`
<article class="story-card ${['story-card-dark','story-card-light','story-card-red'][i]}"><img data-image-role="${role}" src="${img(role)}" alt="${esc(name)}の商品イメージ${i+1}" width="1200" height="1200" loading="lazy"><div><span>SCENE 0${i+1}</span><h2>${esc(catchCopy)}</h2></div></article>`).join('');
  const faqHtml=faq.map(x=>`<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('');
  const faqLd=faq.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}));
  return `<!doctype html><html lang="ja" data-food-ec-updated-at="${esc(queued)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}｜MEAT PLUS</title><meta name="description" content="${esc(meta)}"><link rel="canonical" href="${site}/products/${id}/"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="product"><meta property="og:locale" content="ja_JP"><meta property="og:title" content="${esc(name)}｜MEAT PLUS"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${site}/products/${id}/"><meta property="og:image" content="${imageUrls[0]}"><link rel="stylesheet" href="../../assets/style.css">
<script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@type':'Product',name,sku:id,category,description,image:imageUrls,brand:{'@type':'Brand',name:'MEAT PLUS'},manufacturer:{'@type':'Organization',name:'株式会社MEATPLUS',url:'https://meat-plus.club/'}})}</script>${faqLd.length?`<script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqLd})}</script>`:''}</head><body>
<header class="site-header"><a class="brand" href="../../">MEAT PLUS</a><span>商品ガイド</span></header><main><nav class="breadcrumb"><a href="../../">商品ガイド</a><span>／</span><span>${esc(name)}</span></nav>
<section class="product-hero"><div class="product-shot"><span class="visual-label">${esc(id.toUpperCase())}</span><img class="main-photo" data-image-role="product-list" src="${img('productList')}" alt="${esc(name)}" width="1200" height="1200" fetchpriority="high"></div><div class="product-copy"><p class="eyebrow">${esc(category)}</p><h1>${esc(name)}</h1><p class="lead">${esc(catchCopy)}</p><p>${esc(description)}</p><a class="cta" href="${esc(purchase)}">公式オンラインショップで商品を見る</a><p class="note">価格・在庫・配送条件は公式オンラインショップでご確認ください。</p></div></section>
${stories?`<section class="visual-story" aria-label="${esc(name)}の魅力">${stories}</section>`:''}
<section class="info"><div><p class="eyebrow">PRODUCT INFORMATION</p><h2>商品情報</h2></div><dl>${info.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
${text(p.ingredients)?`<section class="ingredients"><h2>原材料</h2><p>${esc(p.ingredients)}</p></section>`:''}
${faqHtml?`<section class="faq"><p class="eyebrow">FAQ</p><h2>よくあるご質問</h2>${faqHtml}</section>`:''}
<section class="closing"><h2>${esc(closing)}</h2><a class="cta" href="${esc(purchase)}">公式オンラインショップへ</a></section></main><footer><a href="https://meat-plus.club/">MEAT PLUS公式オンラインショップ</a><small>商品ID：${esc(id)}　© MEAT PLUS</small></footer></body></html>`;
};

for (const product of products) {
  const id=text(product.productId).toLowerCase();
  if (!validId(id)) throw new Error('Invalid productId: '+id);
  if (!text(product.updatedAt)) {
    try { await fs.access(path.join('products',id,'index.html')); console.log(id+': legacy published LP preserved'); continue; } catch {}
    throw new Error(id+': publish timestamp is missing');
  }
  const images=await downloadImages(product);
  await fs.mkdir(path.join('products',id),{recursive:true});
  await fs.writeFile(path.join('products',id,'index.html'),render(product,images));
  const record={id,name:text(product.productName),category:text(product.category),description:text(product.cardDescription)||text(product.metaDescription),image:'./assets/products/'+id+'/'+images.productList,updatedAt:text(product.updatedAt)};
  catalog=catalog.filter(x=>x.id!==id); catalog.unshift(record);
}
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/products.json',JSON.stringify(catalog,null,2)+'\n');

const cards=catalog.map(x=>`<a class="card" href="./products/${esc(x.id)}/"><img src="${esc(x.image)}" alt="${esc(x.name)}" width="800" height="800"><div><p class="eyebrow">${esc(x.category)}</p><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><span class="text-link">詳しく見る →</span></div></a>`).join('\n');
const index=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEAT PLUS 商品ガイド</title><meta name="description" content="MEAT PLUSの商品を分かりやすく紹介する公式商品ガイドです。"><link rel="canonical" href="${site}/"><link rel="stylesheet" href="./assets/style.css"></head><body><header class="site-header"><a class="brand" href="./">MEAT PLUS</a><span>商品ガイド</span></header><main><section class="hero"><p class="eyebrow">MEAT PLUS OFFICIAL GUIDE</p><h1>おいしい時間を、<br>もっと身近に。</h1><p>商品の特徴を確認しながら、公式オンラインショップへ進めます。</p></section><section class="catalog"><h2>商品を探す</h2>${cards}</section></main><footer><a href="https://meat-plus.club/">MEAT PLUS公式オンラインショップ</a><small>© MEAT PLUS</small></footer></body></html>`;
await fs.writeFile('index.html',index);

const today=new Date().toISOString().slice(0,10);
const urls=[`<url><loc>${site}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`,...catalog.map(x=>`<url><loc>${site}/products/${esc(x.id)}/</loc><lastmod>${text(x.updatedAt).slice(0,10)||today}</lastmod><priority>1.0</priority></url>`)];
await fs.writeFile('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.join('\n')+'\n</urlset>\n');
