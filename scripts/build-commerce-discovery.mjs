import fs from 'node:fs/promises';
const site='https://meatplus06-afk.github.io/meatplus-lp';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const ld=v=>JSON.stringify(v).replace(/</g,'\\u003c');
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
 const info=Object.fromEntries([...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(m=>[plain(m[1]),plain(m[2])]));
 const scripts=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 const schema=scripts.find(d=>d['@type']==='Product');
 if(!schema)throw new Error('Missing Product schema: '+p.id);
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
 await fs.writeFile(file,html);
 detailed.push({...p,description:factual,productInfo:info,purchaseUrl:buy.href,useCases:uses.map(g=>g.name),sourceUpdatedAt:p.updatedAt});
}
await fs.writeFile('data/products-detailed.json',JSON.stringify(detailed,null,2)+'\n');
const active=groups.filter(g=>detailed.some(p=>p.useCases.includes(g.name)));
const nav=`<nav class="section-nav" data-commerce-guides aria-label="用途から商品を探す">${active.map(g=>`<a href="${site}/guides/${g.slug}/">${esc(g.name)}</a>`).join('')}</nav>`;
let index=await fs.readFile('index.html','utf8');
index=index.replace(/<nav class="section-nav" data-commerce-guides[\s\S]*?<\/nav>/g,'').replace('<section class="catalog" id="catalog">',nav+'<section class="catalog" id="catalog">');
await fs.writeFile('index.html',index);
for(const g of active){
 const rows=detailed.filter(p=>p.useCases.includes(g.name));const url=`${site}/guides/${g.slug}/`;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',url,name:g.name+'の商品比較',publisher:{'@id':'https://meat-plus.club/#organization'}},{'@type':'ItemList',numberOfItems:rows.length,itemListElement:rows.map((p,i)=>({'@type':'ListItem',position:i+1,url:p.url,name:p.name}))}]};
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(g.name)}の商品比較・通販｜MEAT PLUS</title><meta name="description" content="${esc(g.intro)} MEAT PLUS公式の商品情報と購入先をご案内します。"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><script type="application/ld+json">${ld(schema)}</script><link rel="stylesheet" href="../../assets/style.css"></head><body><header class="site-header"><a class="brand" href="${site}/">MEAT PLUS</a><span>商品ガイド</span></header><main><nav class="breadcrumb"><a href="${site}/">商品ガイド</a><span>／</span><span>${esc(g.name)}</span></nav><section class="hero"><h1>${esc(g.name)}の商品を比較する</h1><p>${esc(g.intro)}</p><p>内容量は商品規格を掲載しています。人数の目安は、食事量やほかの料理によって変わります。</p></section><section class="catalog"><h2>${rows.length}商品の内容量・保存方法</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th scope="col">商品</th><th scope="col">内容量・規格</th><th scope="col">保存方法</th><th scope="col">詳しい情報</th></tr></thead><tbody>${rows.map(p=>`<tr><th scope="row" style="padding:16px 8px;border-bottom:1px solid #ddd"><a href="${esc(p.url)}">${esc(p.name)}</a></th><td>${esc(p.productInfo['商品規格']||p.productInfo['内容量']||'商品ページで確認')}</td><td>${esc(p.productInfo['保存方法']||'商品ページで確認')}</td><td><a class="text-link" href="${esc(p.url)}">写真・原材料・購入先 →</a></td></tr>`).join('')}</tbody></table></div><p>価格・在庫・送料・お届け日・ギフト対応は、各商品の公式通販ページで最新情報をご確認ください。</p></section></main><footer><a href="${site}/">商品ガイドTOP</a><a href="${site}/about/">運営者・情報更新方針</a></footer></body></html>`;
 await fs.mkdir(`guides/${g.slug}`,{recursive:true});await fs.writeFile(`guides/${g.slug}/index.html`,html);
}
let sitemap=await fs.readFile('sitemap.xml','utf8');
sitemap=sitemap.replace(/<url><loc>[^<]*\/guides\/[^<]*<\/loc>[\s\S]*?<\/url>\s*/g,'');
const lastmod=products.map(p=>p.updatedAt).filter(Boolean).sort().at(-1)?.slice(0,10);
sitemap=sitemap.replace('</urlset>',active.map(g=>`<url><loc>${site}/guides/${g.slug}/</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:''}</url>`).join('\n')+'\n</urlset>');await fs.writeFile('sitemap.xml',sitemap);
let llms=await fs.readFile('llms.txt','utf8');
llms=llms.replace(/\n## 用途別の商品比較[\s\S]*$/,'')+'\n## 用途別の商品比較\n'+active.map(g=>`- [${g.name}](${site}/guides/${g.slug}/)`).join('\n')+`\n- [詳細商品データ](${site}/data/products-detailed.json)\n`;await fs.writeFile('llms.txt',llms);
await fs.writeFile('llms-full.txt','# MEAT PLUS公式商品情報\n\n価格・在庫・配送条件は公式通販の最新表示を確認してください。\n\n'+detailed.map(p=>`## ${p.name}\n${p.description}\n商品情報: ${p.url}\n購入先: ${p.purchaseUrl}\n用途: ${p.useCases.join('、')}\n`).join('\n'));
// Preparation only: confirm purchasable variants and live prices before upload.
const candidates=detailed.map(p=>({item_id:p.id,title:p.name,description:p.description,url:p.purchaseUrl,brand:'MEAT PLUS',seller_name:'株式会社MEAT PLUS',image_url:p.image,availability:'unknown'}));
await fs.writeFile('data/commerce-candidates.json',JSON.stringify(candidates,null,2)+'\n');
await fs.writeFile('data/commerce-readiness.json',JSON.stringify({status:'preparation_only',submissionReady:false,productCount:candidates.length,blockingFields:['current regular price and sale price per purchasable variant','variant IDs and selected variant URLs','brand verification per item'],documentation:'https://developers.openai.com/commerce/specs/file-upload/products'},null,2)+'\n');
console.log(`Commerce discovery: ${detailed.length} products, ${active.length} purpose guides; feed preparation only.`);
