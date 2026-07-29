import fs from 'node:fs/promises';
import path from 'node:path';

const feedUrl = process.env.LP_FEED_URL;
const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const shop = 'https://meat-plus.club/';
const company = '株式会社MEATPLUS';
const gaMeasurementId = 'G-6WW5KF32KS';
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
const normalizePrice = value => {
  const normalized = text(value).replace(/[,\s￥¥円税込()（）]/g,'');
  return /^\d+(?:\.\d+)?$/.test(normalized) && Number(normalized) > 0 ? normalized : '';
};
const availabilityUrl = value => {
  const normalized = text(value).toLowerCase();
  if (['outofstock','out_of_stock','soldout','sold_out','売り切れ','在庫切れ'].includes(normalized)) return 'https://schema.org/OutOfStock';
  if (['preorder','pre_order','予約'].includes(normalized)) return 'https://schema.org/PreOrder';
  return 'https://schema.org/InStock';
};
const fetchOffer = async (purchaseUrl, product = {}) => {
  const suppliedPrice = normalizePrice(product.price ?? product.salePrice ?? product.productPrice);
  if (suppliedPrice) {
    return {'@type':'Offer',url:purchaseUrl,priceCurrency:'JPY',price:suppliedPrice,availability:availabilityUrl(product.availability),itemCondition:'https://schema.org/NewCondition'};
  }
  try {
    const r = await fetch(purchaseUrl,{redirect:'follow',headers:{'user-agent':'MEATPLUS-LP-Publisher/1.0'},signal:AbortSignal.timeout(15000)});
    if (!r.ok) return null;
    const html = await r.text();
    const sale = html.match(/class=["'][^"']*\bprice\b[^"']*\bsale\b[^"']*["'][^>]*>\s*[￥¥]?\s*([\d,]+)/i);
    const regular = html.match(/class=["'][^"']*\bprice\b[^"']*["'][^>]*>\s*[￥¥]?\s*([\d,]+)/i);
    const price = normalizePrice((sale || regular || [])[1]);
    if (!price) return null;
    const outOfStock = /売り切れ|在庫切れ|sold\s*out/i.test(html);
    return {'@type':'Offer',url:r.url || purchaseUrl,priceCurrency:'JPY',price,availability:outOfStock?'https://schema.org/OutOfStock':'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition'};
  } catch {
    return null;
  }
};
const analytics = `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','${gaMeasurementId}');
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('a.cta').forEach(function(link,index){
    link.addEventListener('click',function(){
      var match=location.pathname.match(/\\/products\\/([^/]+)\\//);
      gtag('event','purchase_button_click',{
        product_id:match?match[1]:'',
        cta_position:index===0?'main':'bottom',
        link_url:link.href,
        transport_type:'beacon'
      });
    });
  });
});
</script>`;

const response = await fetch(feedUrl + '?lp=__github_feed__', {
  method: 'GET',
  redirect: 'follow'
});
if (!response.ok) throw new Error('Feed request failed: ' + response.status);
const rawPayload = await response.text();
let payload;
try {
  payload = JSON.parse(rawPayload);
} catch {
  throw new Error('Feed returned non-JSON content: ' + rawPayload.slice(0, 120).replace(/\s+/g, ' '));
}
const products = Array.isArray(payload.products) ? payload.products : [];
if (!products.length) console.log('No queued products; rebuilding discovery files from the published catalog.');

let catalog = [];
try { catalog = JSON.parse(await fs.readFile('data/products.json','utf8')); } catch {}
if (!Array.isArray(catalog)) catalog = [];
catalog=catalog.map(item=>{const {purchaseUrl,url,...rest}=item; const rawImage=text(rest.image).replace(/^\.\/(?=https?:\/\/)/,''); const image=rawImage.startsWith(site+'/')?'./'+rawImage.slice(site.length+1):rawImage; return {...rest,image};});

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

const render = (p, images, offer) => {
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
  const productUrl=site+'/products/'+id+'/';
  const additionalProperty=info.map(([name,value])=>({'@type':'PropertyValue',name,value:text(value)}));
  const productLd={'@context':'https://schema.org','@type':'Product','@id':productUrl+'#product',url:productUrl,mainEntityOfPage:productUrl,name,sku:id,category,description,image:imageUrls,brand:{'@type':'Brand',name:'MEAT PLUS'},manufacturer:{'@type':'Organization','@id':shop+'#organization',name:company,url:shop},additionalProperty};
  if (offer) productLd.offers=offer;
  const breadcrumbLd={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'MEAT PLUS 商品ガイド',item:site+'/'},{'@type':'ListItem',position:2,name,item:productUrl}]};
  return `<!doctype html><html lang="ja" data-food-ec-updated-at="${esc(queued)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}｜MEAT PLUS公式商品ガイド</title><meta name="description" content="${esc(meta)}"><meta name="author" content="${company}"><link rel="canonical" href="${productUrl}"><link rel="alternate" type="application/json" href="${site}/data/products-public.json"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta property="og:type" content="product"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="MEAT PLUS公式商品ガイド"><meta property="og:title" content="${esc(name)}｜MEAT PLUS"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${productUrl}"><meta property="og:image" content="${imageUrls[0]}"><meta property="og:image:alt" content="${esc(name)}"><meta property="article:modified_time" content="${esc(queued)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(name)}｜MEAT PLUS"><meta name="twitter:description" content="${esc(meta)}"><meta name="twitter:image" content="${imageUrls[0]}"><link rel="stylesheet" href="../../assets/style.css">
<script type="application/ld+json">${jsonLd(productLd)}</script><script type="application/ld+json">${jsonLd(breadcrumbLd)}</script>${faqLd.length?`<script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faqLd})}</script>`:''}${analytics}</head><body>
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
  const offer=await fetchOffer(text(product.purchaseUrl),product);
  await fs.mkdir(path.join('products',id),{recursive:true});
  await fs.writeFile(path.join('products',id,'index.html'),render(product,images,offer));
  const record={id,name:text(product.productName),category:text(product.category),description:text(product.cardDescription)||text(product.metaDescription),image:'./assets/products/'+id+'/'+images.productList,updatedAt:text(product.updatedAt),...(offer?{offer}:{})};
  catalog=catalog.filter(x=>x.id!==id); catalog.unshift(record);
}
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/products.json',JSON.stringify(catalog,null,2)+'\n');

// Keep analytics on legacy LPs that were published before measurement was added.
for (const item of catalog) {
  const pagePath=path.join('products',text(item.id).toLowerCase(),'index.html');
  try {
    let page=await fs.readFile(pagePath,'utf8');
    if (!page.includes(`gtag/js?id=${gaMeasurementId}`)) {
      page=page.replace('</head>',analytics+'</head>');
    }
    if (item.offer) {
      page=page.replace(/<script type="application\/ld\+json">\s*(\{[^<]*"@type"\s*:\s*"Product"[^<]*\})\s*<\/script>/,(_,source)=>{
        try {
          const schema=JSON.parse(source);
          schema.offers=item.offer;
          return `<script type="application/ld+json">${jsonLd(schema)}</script>`;
        } catch { return _; }
      });
    }
    await fs.writeFile(pagePath,page);
  } catch {}
}

const cards=catalog.map(x=>`<a class="card" href="./products/${esc(x.id)}/"><img src="${esc(x.image)}" alt="${esc(x.name)}" width="800" height="800"><div><p class="eyebrow">${esc(x.category)}</p><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><span class="text-link">詳しく見る →</span></div></a>`).join('\n');
const indexLd={'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':shop+'#organization',name:company,alternateName:'MEAT PLUS',url:shop},{'@type':'WebSite','@id':site+'/#website',url:site+'/',name:'MEAT PLUS公式商品ガイド',publisher:{'@id':shop+'#organization'},inLanguage:'ja'},{'@type':'ItemList',name:'MEAT PLUS 商品一覧',numberOfItems:catalog.length,itemListElement:catalog.map((x,i)=>({'@type':'ListItem',position:i+1,url:site+'/products/'+x.id+'/',name:x.name}))}]};
const index=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEAT PLUS公式商品ガイド｜お肉・食品のお取り寄せ</title><meta name="description" content="MEAT PLUSの黒毛和牛、精肉、冷凍食品などの商品情報、原材料、食べ方を紹介する公式商品ガイドです。"><meta name="author" content="${company}"><link rel="canonical" href="${site}/"><link rel="alternate" type="application/json" href="${site}/data/products-public.json"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><meta property="og:type" content="website"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="MEAT PLUS公式商品ガイド"><meta property="og:title" content="MEAT PLUS公式商品ガイド"><meta property="og:description" content="MEAT PLUSの商品情報、原材料、食べ方を紹介します。"><meta property="og:url" content="${site}/"><script type="application/ld+json">${jsonLd(indexLd)}</script>${analytics}<link rel="stylesheet" href="./assets/style.css"></head><body><header class="site-header"><a class="brand" href="./">MEAT PLUS</a><span>商品ガイド</span></header><main><section class="hero"><p class="eyebrow">MEAT PLUS OFFICIAL GUIDE</p><h1>おいしい時間を、<br>もっと身近に。</h1><p>商品の特徴を確認しながら、公式オンラインショップへ進めます。</p></section><section class="catalog"><h2>商品を探す</h2>${cards}</section></main><footer><a href="https://meat-plus.club/">MEAT PLUS公式オンラインショップ</a><small>© MEAT PLUS</small></footer></body></html>`;
await fs.writeFile('index.html',index);

const today=new Date().toISOString().slice(0,10);
const urls=[`<url><loc>${site}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`,...catalog.map(x=>`<url><loc>${site}/products/${esc(x.id)}/</loc><lastmod>${text(x.updatedAt).slice(0,10)||today}</lastmod><priority>1.0</priority><image:image><image:loc>${site}/${esc(x.image.replace(/^\.\//,''))}</image:loc><image:title>${esc(x.name)}</image:title></image:image></url>`)];
await fs.writeFile('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'+urls.join('\n')+'\n</urlset>\n');
await fs.writeFile('robots.txt','User-agent: *\nAllow: /\nSitemap: '+site+'/sitemap.xml\n');
const publicProducts=catalog.map(x=>({id:x.id,name:x.name,category:x.category,description:x.description,url:site+'/products/'+x.id+'/',image:site+'/'+x.image.replace(/^\.\//,''),updatedAt:x.updatedAt}));
await fs.writeFile('data/products-public.json',JSON.stringify(publicProducts,null,2)+'\n');
const llms=['# MEAT PLUS公式商品ガイド','',company+'が運営する食品ECの商品情報サイトです。商品ページには商品名、説明、原材料、規格、保存方法、FAQ、公式購入先を掲載しています。','', '## 公式情報源','- 商品一覧: '+site+'/','- 商品データ(JSON): '+site+'/data/products-public.json','- サイトマップ: '+site+'/sitemap.xml','- 公式オンラインショップ: '+shop,'','## 商品ページ',...publicProducts.map(x=>'- ['+x.name+']('+x.url+'): '+text(x.description).replace(/\s+/g,' ').slice(0,180)),'','商品情報を引用する場合は、各商品ページと公式オンラインショップの最新表示を確認してください。'];
await fs.writeFile('llms.txt',llms.join('\n')+'\n');
