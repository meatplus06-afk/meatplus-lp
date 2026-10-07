import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const products=JSON.parse(await fs.readFile('data/products-detailed.json','utf8'));
assert(products.length>0);
for(const p of products){
 const html=await fs.readFile(`products/${p.id}/index.html`,'utf8');
 assert.equal((html.match(/data-commerce-summary/g)||[]).length,1);
 const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert(schemas.some(s=>s['@type']==='Product'&&s['@id']===p.url+'#product'));
 assert.equal(new URL(p.purchaseUrl).hostname,'meat-plus.club');
 assert(!p.purchaseUrl.includes('utm_'));
 for(const [,value] of schemas.find(s=>s['@type']==='Product').additionalProperty.map(v=>[v.name,v.value]))assert(Object.values(p.productInfo).includes(value));
}
const guides=await fs.readdir('guides');
for(const slug of guides){
 const html=await fs.readFile(`guides/${slug}/index.html`,'utf8');
 for(const m of html.matchAll(/href="https:\/\/meatplus06-afk.github.io\/meatplus-lp\/([^"?#]*)"/g))await fs.access(m[1]+'index.html');
 assert(html.includes('scope="col"'));
}
assert.equal(JSON.parse(await fs.readFile('data/commerce-readiness.json','utf8')).submissionReady,false);
console.log(`Validated ${products.length} products, ${guides.length} guides and preparation-only feed status.`);
