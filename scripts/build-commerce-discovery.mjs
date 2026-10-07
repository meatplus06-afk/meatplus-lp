import fs from 'node:fs/promises';
import {buildGuideExperience} from './guide-experience.mjs';
import {createHash} from 'node:crypto';
const styleVersion=createHash('sha256').update(await fs.readFile('assets/style.css')).digest('hex').slice(0,12);
const site='https://meatplus06-afk.github.io/meatplus-lp';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const ld=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const guideBuy=(p,slug)=>{const u=new URL(p.purchaseUrl);u.searchParams.set('utm_source','github_pages');u.searchParams.set('utm_medium','referral');u.searchParams.set('utm_campaign','guide_'+slug);u.searchParams.set('utm_content',p.id);return esc(u.href);};
const groups=[
 {slug:'yakiniku',name:'焼肉・ステーキ',match:/焼肉|ステーキ/,intro:'焼肉用セットとステーキを、肉の種類・内容量・保存方法から比較できます。'},
 {slug:'sukiyaki',name:'すき焼き・しゃぶしゃぶ',match:/すき焼き|しゃぶしゃぶ/,intro:'すき焼きやしゃぶしゃぶの用途が掲載されている商品を比較できます。'},
 {slug:'nabe',name:'もつ鍋・水炊き',match:/もつ鍋|水炊き/,intro:'もつ鍋と水炊きのセット・スープを比較できます。セットとスープ単品では内容物が異なります。'},
 {slug:'snacks',name:'おつまみ',match:/おつまみ|晩酌/,intro:'商品説明におつまみ・晩酌の用途が掲載されている商品を比較できます。'}
];
const products=JSON.parse(await fs.readFile('data/products-public.json','utf8'));
const detailed=[];
for(const p of products){
 if(!/^[a-z0-9_-]+$/i.test(p.id))throw new Error('Invalid ID');
 const file=`products/${p.id}/index.html`;
 let html=await fs.readFile(file,'utf8');
 html=html.replace(/href="\.\.\/\.\.\/assets\/style\.css(?:\?[^" ]*)?"/g,`href="../../assets/style.css?v=${styleVersion}"`);
 const info=Object.fromEntries([...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(m=>[plain(m[1]),plain(m[2])]));
 const scripts=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 const schema=scripts.find(d=>d['@type']==='Product');
 if(!schema)throw new Error('Missing Product schema: '+p.id);
 // The seller's identity does not establish each item's brand or manufacturer.
 delete schema.brand;delete schema.manufacturer;
 const cta=html.match(/<a[^>]*data-cta-position="(?:main|top)"[^>]*href="([^"]+)"/);
 if(!cta)throw new Error('Missing purchase link: '+p.id);
 const buy=new URL(plain(cta[1]));
 if(buy.hostname!=='meat-plus.club')throw new Error('Unexpected shop URL');
 for(const key of [...buy.searchParams.keys()])if(key.startsWith('utm_'))buy.searchParams.delete(key);
 const facts=Object.entries(info).filter(([k,v])=>k!=='商品名'&&v);
 const factual=[p.name,...facts.map(([k,v])=>`${k}：${v}`)].join('。')+'。';
 const uses=groups.filter(g=>g.match.test(p.name+' '+plain(schema.description)));
 schema['@id']=p.url+'#product';schema.url=p.url;
 schema.additionalProperty=facts.map(([name,value])=>({'@type':'PropertyValue',name,value}));
 html=html.replace(/<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,raw)=>JSON.parse(raw)['@type']==='Product'?`<script${attrs}>${ld(schema)}</script>`:all);
 const summary=`<section class="info" data-commerce-summary><div><h2>商品選びの要点</h2><p>${esc(factual)}</p></div><div><p>価格・在庫・配送日・送料・ギフト対応は、公式通販の商品ページで最新情報をご確認ください。</p>${uses.map(g=>`<p><a class="text-link" href="${site}/guides/${g.slug}/">${esc(g.name)}の商品を比較する →</a></p>`).join('')}</div></section>`;
 html=html.replace(/<section class="info" data-commerce-summary>[\s\S]*?<\/section>/g,'').replace('</main>',summary+'</main>');
 html=html.replace(/<p class="note" data-purchase-help>[\s\S]*?<\/p>/g,'');
 const help=`<p class="note" data-purchase-help><a class="text-link" data-guide-action="shipping" data-product-id="${esc(p.id)}" href="https://meat-plus.club/page/guide#shipping">送料・配送について確認する →</a></p>`;
 html=html.replace(/(<a class="cta" data-cta-position="main"[^>]*>[\s\S]*?<\/a>)/,'$1'+help);
 if(!html.includes('src="../../assets/guide-analytics.js"'))html=html.replace('</head>','<script defer src="../../assets/guide-analytics.js"></script></head>');
 await fs.writeFile(file,html);
 detailed.push({...p,description:factual,productInfo:info,purchaseUrl:buy.href,useCases:uses.map(g=>g.name),sourceUpdatedAt:p.updatedAt});
}
await fs.writeFile('data/products-detailed.json',JSON.stringify(detailed,null,2)+'\n');
// Both hosts are verified in Search Console; Google supports cross-site
// submission. List the shop's parent product URLs, not tracking or variant URLs.
const shopUrls=new Set(['https://meat-plus.club/']);
for(const p of detailed){
 const u=new URL(p.purchaseUrl);
 if(u.protocol!=='https:'||u.hostname!=='meat-plus.club'||u.search||u.hash||!u.pathname.endsWith('/product/'+p.id+'/'))throw new Error('Invalid shop sitemap URL: '+p.id);
 shopUrls.add(u.href);
}
await fs.writeFile('w2-sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...shopUrls].map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('\n')+'\n</urlset>\n');
const active=groups.filter(g=>detailed.some(p=>p.useCases.includes(g.name)));
const nav=`<nav class="section-nav" data-commerce-guides aria-label="用途から商品を探す">${active.map(g=>`<a href="${site}/guides/${g.slug}/">${esc(g.name)}</a>`).join('')}</nav>`;
let index=await fs.readFile('index.html','utf8');
index=index.replace(/<nav class="section-nav" data-commerce-guides[\s\S]*?<\/nav>/g,'').replace('<section class="catalog" id="catalog">',nav+'<section class="catalog" id="catalog">');
await fs.writeFile('index.html',index);
for(const g of active){
 const rows=detailed.filter(p=>p.useCases.includes(g.name));const url=`${site}/guides/${g.slug}/`;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',url,name:g.name+'の商品比較',publisher:{'@id':'https://meat-plus.club/#organization'}},{'@type':'ItemList',numberOfItems:rows.length,itemListElement:rows.map((p,i)=>({'@type':'ListItem',position:i+1,url:p.url,name:p.name}))}]};
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(g.name)}の商品比較・通販｜MEAT PLUS</title><meta name="description" content="${esc(g.intro)} MEAT PLUS公式の商品情報と購入先をご案内します。"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><script type="application/ld+json">${ld(schema)}</script><link rel="stylesheet" href="../../assets/style.css"><script async src="https://www.googletagmanager.com/gtag/js?id=G-6WW5KF32KS"></script><script defer src="../../assets/guide-analytics.js"></script></head><body><header class="site-header"><a class="brand" href="${site}/">MEAT PLUS</a><span>商品ガイド</span></header><main><nav class="breadcrumb"><a href="${site}/">商品ガイド</a><span>／</span><span>${esc(g.name)}</span></nav><section class="hero"><h1>${esc(g.name)}の商品を比較する</h1><p>${esc(g.intro)}</p><p>内容量は商品規格を掲載しています。人数の目安は、食事量やほかの料理によって変わります。</p></section><section class="catalog"><h2>${rows.length}商品の内容量・保存方法</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th scope="col">商品</th><th scope="col">内容量・規格</th><th scope="col">保存方法</th><th scope="col">詳しい情報</th><th scope="col">公式通販</th></tr></thead><tbody>${rows.map(p=>`<tr><th scope="row" style="padding:16px 8px;border-bottom:1px solid #ddd"><a data-guide-action="details" data-product-id="${esc(p.id)}" href="${esc(p.url)}">${esc(p.name)}</a></th><td>${esc(p.productInfo['商品規格']||p.productInfo['内容量']||'商品ページで確認')}</td><td>${esc(p.productInfo['保存方法']||'商品ページで確認')}</td><td><a class="text-link" data-guide-action="details" data-product-id="${esc(p.id)}" href="${esc(p.url)}">写真・原材料 →</a></td><td><a class="text-link" data-guide-action="purchase" data-product-id="${esc(p.id)}" href="${guideBuy(p,g.slug)}">価格・在庫を確認 →</a></td></tr>`).join('')}</tbody></table></div><p>価格・在庫・送料・お届け日・ギフト対応は、各商品の公式通販ページで最新情報をご確認ください。</p></section></main><footer><a href="${site}/">商品ガイドTOP</a><a href="${site}/about/">運営者・情報更新方針</a></footer></body></html>`;
 await fs.mkdir(`guides/${g.slug}`,{recursive:true});await fs.writeFile(`guides/${g.slug}/index.html`,html);
}
let sitemap=await fs.readFile('sitemap.xml','utf8');
sitemap=sitemap.replace(/<url><loc>[^<]*\/guides\/[^<]*<\/loc>[\s\S]*?<\/url>\s*/g,'');
const lastmod=products.map(p=>p.updatedAt).filter(Boolean).sort().at(-1)?.slice(0,10);
sitemap=sitemap.replace('</urlset>',active.map(g=>`<url><loc>${site}/guides/${g.slug}/</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:''}</url>`).join('\n')+'\n</urlset>');await fs.writeFile('sitemap.xml',sitemap);
let llms=await fs.readFile('llms.txt','utf8');
llms=llms.replace(/\n## 用途別の商品比較[\s\S]*$/,'')+'\n## 用途別の商品比較\n'+active.map(g=>`- [${g.name}](${site}/guides/${g.slug}/)`).join('\n')+`\n- [詳細商品データ](${site}/data/products-detailed.json)\n`;await fs.writeFile('llms.txt',llms);
await fs.writeFile('llms-full.txt','# MEAT PLUS公式商品情報\n\n価格・在庫・配送条件は公式通販の最新表示を確認してください。\n\n'+detailed.map(p=>`## ${p.name}\n${p.description}\n商品情報: ${p.url}\n購入先: ${p.purchaseUrl}\n用途: ${p.useCases.join('、')}\n`).join('\n'));
// Preparation only: brand and selected-variant identity require verification.
let snapshot=null;
try{snapshot=JSON.parse(await fs.readFile('data/w2-offers.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const fresh=!!snapshot && Number.isFinite(Date.parse(snapshot.fetchedAt)) && Date.now()-Date.parse(snapshot.fetchedAt)>=0 && Date.now()-Date.parse(snapshot.fetchedAt)<48*60*60*1000;
const candidates=[];
for(const p of detailed){
 const offers=fresh?snapshot.items.filter(r=>r.productId===p.id):[];
 const base={description:p.description,seller_name:'株式会社MEAT PLUS'};
 if(!offers.length)candidates.push({...base,item_id:p.id,title:p.name,url:p.purchaseUrl,image_url:new URL(p.image,site+'/').href,availability:'unknown'});
 else for(const r of offers){
  const row={...base,item_id:r.item_id,title:r.title,url:r.url,image_url:r.image_url,availability:r.availability,price:r.price};
  // Parent specifications may describe only one size or flavor.
  if(r.hasVariations){
   row.description=[r.title,'MEAT PLUS公式通販の商品です',...['保存方法','原産国','製造地'].filter(k=>p.productInfo[k]).map(k=>k+'：'+p.productInfo[k])].join('。')+'。';
   row.group_id=p.id;row.listing_has_variations=true;
   if(r.variantUrlVerified&&r.variant_dict)row.variant_dict=r.variant_dict;
  }
  if(r.sale_price)row.sale_price=r.sale_price;
  candidates.push(row);
 }
}
await fs.writeFile('data/commerce-candidates.json',JSON.stringify(candidates,null,2)+'\n');
const pending=detailed.filter(p=>!fresh||!snapshot.items.some(r=>r.productId===p.id)).map(p=>p.id);
const blockers=['brand verification per item'];
if(pending.length)blockers.push('current regular price per missing product');
if(fresh&&snapshot.items.some(r=>r.variantUrlReviewRequired))blockers.push('variant option names, selected variant URLs and variant-specific descriptions');
if(fresh&&snapshot.items.some(r=>r.priceReviewRequired||r.subscriptionOnly||(!r.canPurchase&&r.availability!=='out_of_stock')))blockers.push('purchase eligibility or price relationship review');
await fs.writeFile('data/commerce-readiness.json',JSON.stringify({status:'preparation_only',submissionReady:false,productCount:detailed.length,itemCount:candidates.length,pricedItemCount:candidates.filter(r=>r.price).length,storefrontFetchedAt:snapshot?.fetchedAt||null,storefrontSnapshotFresh:fresh,pendingProductIds:pending,blockingFields:blockers,documentation:'https://developers.openai.com/commerce/specs/file-upload/products'},null,2)+'\n');
console.log(`Commerce discovery: ${detailed.length} products, ${active.length} purpose guides; ${candidates.filter(r=>r.price).length} priced items, feed preparation only.`);

await buildGuideExperience(detailed,active,snapshot,fresh);
