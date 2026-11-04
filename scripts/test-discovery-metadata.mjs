import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('./build-discovery.mjs',import.meta.url).pathname;
test('rebuild refreshes owned schema without removing product facts and omits invented lastmod',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mp-discovery-'));
 try{
  await fs.mkdir(path.join(dir,'data'));await fs.mkdir(path.join(dir,'products/a001'),{recursive:true});
  const p={id:'a001',name:'初回の商品',url:'https://meatplus06-afk.github.io/meatplus-lp/products/a001/',category:'a 牛肉',image:'https://meatplus06-afk.github.io/meatplus-lp/assets/products/a001/product-list.jpg',updatedAt:'2026-10-01T12:00:00Z',description:'登録された説明'};
  const write=()=>fs.writeFile(path.join(dir,'data/products-public.json'),JSON.stringify([p]));await write();
  await fs.writeFile(path.join(dir,'index.html'),'<html><head></head><body><main><section class="catalog" id="catalog"></section></main></body></html>');
  const file=path.join(dir,'products/a001/index.html');await fs.writeFile(file,'<html><head><script type="application/ld+json">{"@type":"Product","name":"保持する商品"}</script></head><body><main>保持する説明本文</main></body></html>');
  const build=()=>{const r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
  build();p.name='更新後の商品';p.updatedAt='2026-11-02T09:00:00Z';await write();build();
  const html=await fs.readFile(file,'utf8');const owned=[...html.matchAll(/<script id="discovery-webpage-schema" type="application\/ld\+json">(.*?)<\/script>/g)];
  assert.equal(owned.length,1);const schema=JSON.parse(owned[0][1]);assert.equal(schema.name,p.name);assert.equal(schema.dateModified,p.updatedAt);assert(html.includes('保持する説明本文'));assert(html.includes('保持する商品'));
  const map=await fs.readFile(path.join(dir,'sitemap.xml'),'utf8');const entries=map.match(/<url>.*?<\/url>/g);assert(entries.filter(e=>!e.includes('/products/')).every(e=>!e.includes('<lastmod>')));assert(map.includes('<lastmod>2026-11-02</lastmod>'));
  p.updatedAt='2026-02-31';await write();build();assert(!(await fs.readFile(path.join(dir,'sitemap.xml'),'utf8')).includes('<lastmod>'));assert(!JSON.parse((await fs.readFile(file,'utf8')).match(/id="discovery-webpage-schema" type="application\/ld\+json">(.*?)<\/script>/)[1]).dateModified);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
