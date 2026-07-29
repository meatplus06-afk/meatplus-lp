import fs from 'node:fs/promises';

const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const host = 'meatplus06-afk.github.io';
const key = (await fs.readFile('indexnow-key.txt','utf8')).trim();
const catalog = JSON.parse(await fs.readFile('data/products.json','utf8'));
const urlList = [
  site + '/',
  site + '/sitemap.xml',
  site + '/llms.txt',
  site + '/data/products-public.json',
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
