import fs from 'node:fs/promises';

const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const host = 'meatplus06-afk.github.io';
const key = (await fs.readFile('indexnow-key.txt','utf8')).trim();
const catalog = JSON.parse(await fs.readFile('data/products.json','utf8'));
const publicProducts = JSON.parse(await fs.readFile('data/products-public.json','utf8'));
const categoryLabel = value => String(value ?? '').trim().replace(/^[a-z0-9]+[\s　]+/i, '') || 'その他';
const categoryCode = value => (String(value ?? '').trim().match(/^([a-z0-9]+)[\s　]+/i) || [])[1]?.toLowerCase() || '';
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
const categoryUrls = [...new Set((Array.isArray(publicProducts) ? publicProducts : []).map(item => site + '/categories/' + categorySlug(item.category) + '/'))];
const urlList = [
  site + '/',
  site + '/about/',
  site + '/sitemap.xml',
  site + '/llms.txt',
  site + '/llms-full.txt',
  site + '/data/products-public.json',
  ...categoryUrls,
  ...catalog.map(item => site + '/products/' + item.id + '/')
];

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: {'content-type':'application/json; charset=utf-8'},
  body: JSON.stringify({
    host,
    key,
    keyLocation: site + '/indexnow-key.txt',
    urlList
  })
});

if (![200,202].includes(response.status)) {
  throw new Error('IndexNow submission failed: ' + response.status + ' ' + (await response.text()).slice(0,300));
}
console.log('IndexNow accepted ' + urlList.length + ' URL(s): ' + response.status);
