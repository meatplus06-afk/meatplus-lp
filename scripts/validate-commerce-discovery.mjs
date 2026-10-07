import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const products=JSON.parse(await fs.readFile('data/products-detailed.json','utf8'));
assert(products.length>0);
for(const p of products){
 const html=await fs.readFile(`products/${p.id}/index.html`,'utf8');
 assert.equal((html.match(/data-commerce-summary/g)||[]).length,1);
 const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert(schemas.some(s=>s['@type']==='Product'&&s['@id']===p.url+'#product'));
 const productSchema=schemas.find(s=>s['@type']==='Product');
 assert(!productSchema.brand&&!productSchema.manufacturer,'Unverified brand/manufacturer: '+p.id);
 assert.equal((html.match(/data-purchase-help/g)||[]).length,1);
 assert(html.includes('https://meat-plus.club/page/guide#shipping'));
 assert.equal(new URL(p.purchaseUrl).hostname,'meat-plus.club');
 assert(!p.purchaseUrl.includes('utm_'));
 for(const [,value] of schemas.find(s=>s['@type']==='Product').additionalProperty.map(v=>[v.name,v.value]))assert(Object.values(p.productInfo).includes(value));
}
const guides=await fs.readdir('guides');
for(const slug of guides){
 const html=await fs.readFile(`guides/${slug}/index.html`,'utf8');
 for(const m of html.matchAll(/href="https:\/\/meatplus06-afk.github.io\/meatplus-lp\/([^"?#]*)"/g))await fs.access(m[1]+'index.html');
 assert(html.includes('scope="col"'));
 assert(html.includes('guide-analytics.js'));
 assert(html.includes('data-guide-action="purchase"'));
 for(const m of html.matchAll(/data-guide-action="purchase"[^>]*href="([^"]+)"/g)){const u=new URL(m[1].replaceAll('&amp;','&'));assert.equal(u.hostname,'meat-plus.club');assert.equal(u.searchParams.get('utm_campaign'),'guide_'+slug);}
}
assert.equal(JSON.parse(await fs.readFile('data/commerce-readiness.json','utf8')).submissionReady,false);
console.log(`Validated ${products.length} products, ${guides.length} guides and preparation-only feed status.`);

const candidates=JSON.parse(await fs.readFile('data/commerce-candidates.json','utf8'));
assert.equal(new Set(candidates.map(r=>r.item_id)).size,candidates.length);
for(const row of candidates){assert.equal(new URL(row.url).hostname,'meat-plus.club');assert(new URL(row.image_url).protocol==='https:');assert(row.description);if(row.price){assert(/^\d+(?:\.\d+)? JPY$/.test(row.price));if(row.sale_price)assert(parseFloat(row.sale_price)<parseFloat(row.price));}}
const offers=JSON.parse(await fs.readFile('data/w2-offers.json','utf8'));
for(const row of candidates.filter(r=>r.listing_has_variations)){
 assert(row.group_id);
 assert(row.description.startsWith(row.title+'。'));
 const offer=offers.items.find(r=>r.item_id===row.item_id);
 if(offer?.variantUrlVerified){
  assert.equal(row.url,offer.url);
  assert(new URL(row.url).pathname.endsWith('/product/'+row.group_id+'/'+row.item_id+'/'));
  assert.deepEqual(row.variant_dict,offer.variant_dict);
  assert.equal(Object.values(row.variant_dict)[0],row.title);
 }
}
