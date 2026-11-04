import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildEditorial,selectRows,topics} from './build-editorial.mjs';
import {specExamples} from './editorial-view.mjs';
const fixture=(id='m001')=>({id,name:'テスト <肉>',category:'m 贈り物',url:`https://meatplus06-afk.github.io/meatplus-lp/products/${id}/`,purchaseUrl:`https://meat-plus.club/product/${id}/`,productInfo:{商品規格:'500g',保存方法:'冷凍'},useCases:[]});
test('requires explicit facts and deduplicates the same purchase specification',()=>{
 const a=fixture(),b={...a,id:'m002'},c={...fixture('m003'),productInfo:{商品規格:'500g'}};
 assert.equal(selectRows(topics[1],[a,b,c]).length,1);
});
test('builds only supported topics, escapes data, refreshes changed facts and removes retired articles and links',async()=>{
 const cwd=process.cwd(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'mp-editorial-'));
 try{
 process.chdir(dir);await fs.mkdir('data');await fs.mkdir('guides/nabe',{recursive:true});await fs.writeFile('guides/nabe/index.html','<main></main>');await fs.writeFile('index.html','<main></main>');await fs.writeFile('sitemap.xml','<urlset></urlset>');await fs.writeFile('llms.txt','# Guide');
 const products=[fixture(),fixture('m002')];for(const p of products){await fs.mkdir(`products/${p.id}`,{recursive:true});await fs.writeFile(`products/${p.id}/index.html`,'<main></main>');}
 await buildEditorial(products);let html=await fs.readFile('articles/meat-gift-checklist/index.html','utf8');assert(html.includes('テスト &lt;肉&gt;'));assert(!html.includes('テスト <肉>'));assert(html.includes('utm_campaign=article_meat-gift-checklist'));assert(html.includes('data-product-id="m001"'));assert(html.includes('押さえたい3つのポイント'));assert(html.includes('図でつかむ'));assert((await fs.readFile('articles/index.html','utf8')).includes('食の読みもの'));const map=await fs.readFile('sitemap.xml','utf8');assert.equal((map.match(/<loc>https:\/\/meatplus06-afk.github.io\/meatplus-lp\/articles\/<\/loc>/g)||[]).length,1);
 const first=await fs.readFile('data/editorial-state.json','utf8');await buildEditorial(products);assert.equal(await fs.readFile('data/editorial-state.json','utf8'),first);assert.equal(await fs.readFile('articles/meat-gift-checklist/index.html','utf8'),html);
 const old=JSON.parse(first);old['meat-gift-checklist'].modified='2000-01-01';await fs.writeFile('data/editorial-state.json',JSON.stringify(old));products[0].productInfo.商品規格='700g';await buildEditorial(products);html=await fs.readFile('articles/meat-gift-checklist/index.html','utf8');assert(html.includes('700g'));assert(!html.includes('datetime="2000-01-01"'));
 await buildEditorial([products[0]]);await assert.rejects(fs.access('articles/meat-gift-checklist/index.html'));assert(!(await fs.readFile('products/m001/index.html','utf8')).includes('data-editorial-links'));assert(!(await fs.readFile('sitemap.xml','utf8')).includes('/articles/'));await assert.rejects(fs.access('articles/index.html'));
 }finally{process.chdir(cwd);await fs.rm(dir,{recursive:true,force:true});}
});

test('company story stays scoped to meat and specification diagrams refuse ambiguous totals',()=>{
 const t=topics.find(t=>t.slug==='meatplus-craft');
 assert(t.match({...fixture(),category:'a 牛肉'}));
 assert(!t.match({...fixture(),category:'j 海鮮・魚介類',name:'うなぎ蒲焼'}));
 const p={...fixture('m002'),image:'https://example.com/photo.jpg',productInfo:{商品規格:'420ｇ（70ｇ×6ｐ）',保存方法:'冷凍'}};
 const html=specExamples(t,[p]);assert(html.includes('70g × 6点'));assert(html.includes('420g'));
 p.productInfo.商品規格='420g（100g×6p）';assert(!specExamples(t,[p]).includes('ed-count-pieces'));
 p.productInfo.商品規格='420g（70g×6p）・700g';assert(!specExamples(t,[p]).includes('ed-count-pieces'));
});
