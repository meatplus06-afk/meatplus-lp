import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {topics} from './editorial-content.mjs';
import {site,esc,renderArticle,renderHub,relatedStrip,homeJournal} from './editorial-view.mjs';
export {topics};
export function selectRows(topic,products){
 const unique=new Map();
 for(const p of products){
  if(!/^[a-z0-9_-]+$/i.test(p.id)||!topic.match(p)||!p.productInfo?.['商品規格']||!p.productInfo?.['保存方法'])continue;
  const key=p.purchaseUrl+'|'+p.productInfo['商品規格'];
  if(!unique.has(key))unique.set(key,p);
 }
 return [...unique.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
const stylesheet=(html,version)=>html.replace(/<link[^>]*data-editorial-style[^>]*>/g,'').replace('</head>',`<link data-editorial-style rel="stylesheet" href="${site}/assets/editorial.css?v=${version}"></head>`);
export async function buildEditorial(products){
 let prior={};try{prior=JSON.parse(await fs.readFile('data/editorial-state.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const template=await fs.readFile(new URL('./editorial-view.mjs',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../assets/editorial.css',import.meta.url),'utf8');
 const version=createHash('sha256').update(template+css).digest('hex').slice(0,12);
 const state={},active=[],today=new Date().toISOString().slice(0,10);
 for(const topic of topics){
  const rows=selectRows(topic,products);if(rows.length<2)continue;
  const {match,...copy}=topic;
  const hash=createHash('sha256').update(JSON.stringify({copy,version,rows:rows.map(p=>({id:p.id,name:p.name,image:p.image,url:p.url,purchaseUrl:p.purchaseUrl,info:p.productInfo}))})).digest('hex');
  const old=prior[topic.slug],modified=old?.hash===hash?old.modified:today,published=old?.published||today;
  state[topic.slug]={hash,modified,published,productIds:rows.map(p=>p.id)};active.push({topic,rows,modified,published});
 }
 for(const a of active){const dir=`articles/${a.topic.slug}`;await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/index.html',renderArticle(a,active,version));}
 // Only retire known topics. Never remove independently authored pages.
 for(const topic of topics)if(!state[topic.slug])await fs.rm(`articles/${topic.slug}`,{recursive:true,force:true});
 if(active.length){await fs.mkdir('articles',{recursive:true});await fs.writeFile('articles/index.html',renderHub(active,version));}
 else await fs.rm('articles/index.html',{force:true});
 for(const p of products){
  const file=`products/${p.id}/index.html`;let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="info(?: ed-related-entry)?" data-editorial-links>[\s\S]*?<\/section>/g,'');
  const relevant=active.filter(a=>a.rows.some(r=>r.id===p.id));
  if(relevant.length)html=html.replace('</main>',`<section class="info ed-related-entry" data-editorial-links><div><h2>選び方を、図で見てみる。</h2>${relatedStrip(relevant)}</div></section></main>`);
  await fs.writeFile(file,stylesheet(html,version));
 }
 for(const slug of await fs.readdir('guides')){
  const file=`guides/${slug}/index.html`;let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="catalog(?: ed-related-entry)?" data-editorial-links>[\s\S]*?<\/section>/g,'');
  const relevant=active.filter(a=>a.topic.guide===slug);
  if(relevant.length)html=html.replace('</main>',`<section class="catalog ed-related-entry" data-editorial-links><h2>食べ方から、もう少し詳しく。</h2>${relatedStrip(relevant)}</section></main>`);
  await fs.writeFile(file,stylesheet(html,version));
 }
 let home=await fs.readFile('index.html','utf8');
 home=home.replace(/<nav data-editorial-nav[\s\S]*?<\/nav>/g,'').replace(/<section data-editorial-home[\s\S]*?<\/section>/g,'');
 if(active.length){const section=homeJournal(active);home=home.includes('<section class="catalog" id="catalog">')?home.replace('<section class="catalog" id="catalog">',section+'<section class="catalog" id="catalog">'):home.replace('</main>',section+'</main>');}
 await fs.writeFile('index.html',stylesheet(home,version));
 let sitemap=await fs.readFile('sitemap.xml','utf8');
 for(const path of ['',...topics.map(t=>t.slug+'/')])sitemap=sitemap.replace(new RegExp('<url><loc>'+site+'/articles/'+path+'</loc>[\\s\\S]*?</url>\\s*','g'),'');
 const entries=active.map(a=>`<url><loc>${site}/articles/${a.topic.slug}/</loc><lastmod>${a.modified}</lastmod></url>`);
 if(active.length)entries.unshift(`<url><loc>${site}/articles/</loc><lastmod>${active.map(a=>a.modified).sort().at(-1)}</lastmod></url>`);
 sitemap=sitemap.replace('</urlset>',entries.join('\n')+'\n</urlset>');await fs.writeFile('sitemap.xml',sitemap);
 let llms=await fs.readFile('llms.txt','utf8');llms=llms.replace(/\n## 商品選びの記事[\s\S]*$/,'');
 if(active.length)llms+='\n## 商品選びの記事\n'+`- [食の読みもの一覧](${site}/articles/)\n`+active.map(a=>`- [${a.topic.title}](${site}/articles/${a.topic.slug}/)`).join('\n')+'\n';
 await fs.writeFile('llms.txt',llms);await fs.writeFile('data/editorial-state.json',JSON.stringify(state,null,2)+'\n');
 console.log(`Editorial: ${active.length} illustrated, evidence-linked articles and article hub; no AI API calls.`);
}
