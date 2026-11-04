import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const site='https://meatplus06-afk.github.io/meatplus-lp';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ld=v=>JSON.stringify(v).replace(/</g,'\\u003c');
// Fixed editorial topics, not one thin article for every SKU or keyword.
export const topics=[
 {slug:'sukiyaki-choose',title:'すき焼き・しゃぶしゃぶ肉の選び方｜部位・内容量・保存方法を比べる',match:p=>p.useCases?.includes('すき焼き・しゃぶしゃぶ'),guide:'sukiyaki',intro:'すき焼き用のお肉は、商品名に書かれた部位と用途、商品規格、保存方法を順に比べると候補を絞れます。同じ黒毛和牛でも、すべての商品が同じ部位や容量とは限りません。',sections:[['部位と用途を分けて確認する','まず「すき焼き用」の記載があるかを確認し、そのうえでロース、肩ロース、モモ、切り落としなどの商品表示を見比べます。商品名だけから柔らかさや脂の量を断定せず、商品ごとの説明を確認してください。'],['容量と選択肢を確認する','「500g」と「500g×2パック」では届く総量が異なります。複数容量を選べる商品は、注文画面で選択した規格が対象です。何人分になるかは食事量やほかの料理によるため、内容量を基準に選びましょう。'],['保存と調理の案内を確認する','冷凍・冷蔵などの保存条件と賞味期限を確認します。解凍方法や加熱時間は商品固有の案内を優先し、記載がない条件をほかの商品から流用しないでください。']],faq:[['同じ容量なら同じ商品ですか？','容量だけでは判断できません。商品名の部位・原材料・用途と、選択した規格をあわせて比べてください。'],['贈り物にできますか？','商品ごとに包装・のし・配送指定の条件を公式通販で確認してください。この一覧への掲載だけで贈答対応を示すものではありません。']]},
 {slug:'meat-gift-checklist',title:'肉ギフト・お歳暮の選び方｜購入前に確認したい条件',match:p=>/贈り物/.test(p.category),guide:null,intro:'肉ギフトやお歳暮は、贈る相手の食べ方と保管場所に合う内容を選び、注文前に包装・配送条件を確認しましょう。贈り物カテゴリに掲載されていても、包装やのしの対応は商品ごとに確認が必要です。',sections:[['相手が楽しめる食べ方から選ぶ','すき焼き、焼肉、ステーキなど、商品に記載された用途から候補を選びます。調理の手間を減らしたい場合も、調理済みかどうかは商品説明で確認してください。'],['受け取り後の保管を考える','内容量、パック数、保存方法を見比べます。冷凍商品は相手の冷凍庫に入る量か、希望する時期に受け取れるかを考えて選びましょう。'],['包装とお届け条件は注文前に確認する','のし、名入れ、ギフト包装、金額の分かる書類の同梱、配送先指定は公式通販で確認します。お歳暮の締切や到着予定日を、前年の情報や他店の条件から推測しないでください。']],faq:[['ギフト包装やのしは全商品で選べますか？','このガイドでは一律の対応を案内していません。購入候補の商品ページと注文画面でご確認ください。'],['予算は商品価格だけで決めてよいですか？','送料や包装料、選択する容量によって支払額が変わることがあります。公式通販で注文内容に対応する合計金額を確認してください。']]},
 {slug:'nabe-set-or-soup',title:'もつ鍋・水炊き通販の選び方｜セットとスープ単品の違い',match:p=>/もつ鍋|水炊き/.test(p.name),guide:'nabe',intro:'鍋通販では、まず肉や具材を含むセットか、スープ単品かを確認しましょう。商品名に「もつ鍋」「水炊き」とあっても内容物は同じとは限りません。味や規格を比べる前に、届くものと別に用意するものを分けることが大切です。',sections:[['届くものを商品情報で確かめる','セットの内訳、肉の有無、スープの量を商品ごとに確認します。写真に写る野菜や薬味が、すべて同梱されるとは限りません。原材料表示だけでセット全体の構成が分からない場合は、公式通販の内容物の案内を確認してください。'],['味と容量を混同しない','醤油・味噌などの味違い、容量違いがある場合は、注文する選択肢に対応した原材料と規格を確認します。複数の味の説明があっても、全種類が届くとは限りません。'],['準備と保存の条件を確認する','保存方法、賞味期限、調理手順を確認してから注文します。濃縮タイプか、そのまま使うスープかも商品固有の案内を優先し、薄める倍率や加熱時間を推測しないでください。']],faq:[['鍋スープには肉も付いていますか？','スープ単品と肉付きセットは別の商品です。商品名、商品規格、セット内容を確認してください。'],['掲載の容量から人数を決められますか？','スープと肉では容量の意味が異なります。商品に人数目安があれば確認し、ほかの料理や食事量も考慮してください。']]}
];
// Editorial explanations are reviewed copy; product specifications stay source-linked.
const additions={
 'sukiyaki-choose':[
  ['総量と一度に使う量を分けて考える','たとえば500gの1パックと250gの2パックは合計では同じ500gです。一方、別の日に分けて使いたいなら、パックごとの量も判断材料になります。小分け包装かどうかは商品表示で確認します。「500g×2パック」は合計1kgですが、容量を選ぶ形式の商品は選択した規格が対象です。'],
  ['比較表から候補を絞る手順','最初に用途、次に商品規格、最後に保存方法を見比べます。部位やブランド名が異なる商品を、内容量だけで同等品とは扱いません。気になる商品の情報ページを開き、原材料・産地などの表示を確認してから購入条件を比べると、選択の根拠が整理できます。'],
  ['価格を比べるときの計算例','総額3,000円・内容量500gなら、100g当たりは600円です。これは計算例で、掲載商品の販売価格ではありません。送料・包装料を含めるかをそろえ、同じ容量・セット内容・選択肢で比較します。価格だけで肉質や満足度の順位は決められません。']
 ],
 'meat-gift-checklist':[
  ['少人数世帯と大人数世帯では見る点が変わる','少人数の相手には一度に使う量とパック数、大人数で食べる相手には総量とセットの内訳が判断材料になります。たとえば同じ1kgでも、1袋か複数袋かで使い方は変わります。人数だけから必要量を断定せず、食べる場面や他の料理も考えて選びます。'],
  ['サプライズより先に確認したい受け取り条件','冷凍・冷蔵品を贈る場合は、不在の予定や保管場所を確認しておくと候補を選びやすくなります。注文日と到着日は同じではありません。希望日指定の可否、届け先住所、発送予定を購入画面で確認し、案内のない日時は約束しないようにします。'],
  ['注文前の最終確認メモ','商品名と選択規格、合計金額、送り先、送り主名、希望日、のし・包装の選択を確認します。ギフト対応の記載がない項目は、対応していると推測せず購入前に問い合わせます。下の比較表は商品の候補選びに使い、包装や配送の最終条件は公式通販で確認してください。']
 ],
 'nabe-set-or-soup':[
  ['スープ単品とセットを予算で比べる例','スープ単品を選ぶ場合は、別に用意する肉や野菜などの費用と準備も含めて考えます。肉付きセットでも野菜や麺が付くとは限りません。「届くもの」「自分で用意するもの」を書き分けると、価格差の理由を確認しやすくなります。'],
  ['「何人前」と重量は別の情報','人数の目安がある場合も、肉の重量、スープ量、麺などの有無をあわせて確認します。スープ500gと肉500gは同じ食事量を意味しません。複数の味や容量を選べる商品では、選択中の組み合わせに対応する内訳を確認してください。'],
  ['原材料とアレルゲンは選んだ味ごとに確認','醤油味と味噌味など、味が変われば原材料表示も変わることがあります。原材料の説明を別の味から流用せず、選択した商品のアレルゲン表示を購入先で確認します。食物アレルギーがある場合、表示が不明な商品について自己判断で安全とみなさないでください。']
 ]
};
for(const topic of topics)topic.sections.push(...(additions[topic.slug]||[]));
topics.push({slug:'frozen-meat-thawing',title:'冷凍肉の解凍・保存｜届いてから調理するまでの確認ポイント',match:p=>/冷凍/.test(p.productInfo?.['保存方法']||'')&&/牛|豚|鶏|肉|もつ/.test(p.name),guide:null,
 intro:'冷凍肉は、届いた商品の保存表示と調理案内を確認して扱います。ここでは家庭での一般的な注意点と、通販の商品選びで確認したい包装・容量の情報を整理します。商品ごとの解凍時間や加熱条件を一律に指定するものではありません。',
 sections:[
 ['届いたら保存表示を確認する','冷凍保存の商品は受け取り後に冷凍庫へ入れ、包装の保存条件と期限を確認します。保存方法の表示と配送方法は別の情報です。「冷凍保存」という記載だけから、配送便の種類や解凍後の日持ちを判断しないでください。'],
 ['解凍は調理台に置きっぱなしにしない','厚生労働省は、室温で長く放置する解凍を避け、冷蔵庫や電子レンジを利用する方法を案内しています。電子レンジを使う場合も商品の対応可否や器具の説明を確認してください。必要時間は肉の厚さや量、包装などで変わるため、本記事では一律の時間を示しません。'],
 ['使う分を考えて、肉汁が他の食品に触れないようにする','使う分だけ解凍し、解凍後は速やかに調理します。肉汁が他の食品に付かないよう容器などで受け、生肉を扱う器具と食べる器具を分けます。解凍と再冷凍の繰り返しは避けてください。'],
 ['購入時にパック数も見る','別の日に分けて調理したい場合は、総重量だけでなく1パックの量も確認します。500g×2パックと1kg×1パックは総量が同じでも包装が異なります。小分けの可否は商品名から推測せず、商品規格や包装の案内で確認しましょう。']
 ],faq:[['冷蔵庫なら何時間で解凍できますか？','厚みや量、温度などで変わります。商品固有の案内を確認し、すべての商品に同じ時間を当てはめないでください。'],['冷凍保存の賞味期限は解凍後にも使えますか？','表示された保存条件を前提とする期限です。解凍後の扱いは商品案内を確認し、元の期限まで保存できると判断しないでください。']],
 sources:[['厚生労働省：家庭でできる食中毒予防の6つのポイント','https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/01_00006.html']]
});
export function selectRows(topic,products){
 const unique=new Map();
 for(const p of products){
  if(!/^[a-z0-9_-]+$/i.test(p.id)||!topic.match(p)||!p.productInfo?.['商品規格']||!p.productInfo?.['保存方法'])continue;
  // Collapse records with the same purchase destination and specification.
  const key=p.purchaseUrl+'|'+p.productInfo['商品規格'];
  if(!unique.has(key))unique.set(key,p);
 }
 return [...unique.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export async function buildEditorial(products){
 let prior={};try{prior=JSON.parse(await fs.readFile('data/editorial-state.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const state={};const active=[];const today=new Date().toISOString().slice(0,10);
 for(const topic of topics){
  const rows=selectRows(topic,products);if(rows.length<2)continue;
  const {match,...copy}=topic;
  const hash=createHash('sha256').update(JSON.stringify({copy,rows:rows.map(p=>({id:p.id,name:p.name,url:p.url,purchaseUrl:p.purchaseUrl,info:p.productInfo}))})).digest('hex');
  const old=prior[topic.slug];const modified=old?.hash===hash?old.modified:today;const published=old?.published||today;
  state[topic.slug]={hash,modified,published,productIds:rows.map(p=>p.id)};
  active.push({topic,rows,modified});
  const url=`${site}/articles/${topic.slug}/`;
  const schema={'@context':'https://schema.org','@type':'Article','@id':url+'#article',headline:topic.title,description:topic.intro,url,mainEntityOfPage:url,inLanguage:'ja',datePublished:published,dateModified:modified,author:{'@type':'Organization',name:'株式会社MEATPLUS',url:site+'/about/'},publisher:{'@id':'https://meat-plus.club/#organization'},about:rows.map(p=>({'@id':p.url+'#product'}))};
  const table=rows.map(p=>{const u=new URL(p.purchaseUrl);u.searchParams.set('utm_source','github_pages');u.searchParams.set('utm_medium','referral');u.searchParams.set('utm_campaign','article_'+topic.slug);u.searchParams.set('utm_content',p.id);return `<tr><th scope="row"><a data-guide-action="details" data-product-id="${esc(p.id)}" href="${esc(p.url)}">${esc(p.name)}</a></th><td>${esc(p.productInfo['商品規格'])}</td><td>${esc(p.productInfo['保存方法'])}</td><td><a data-guide-action="purchase" data-guide-position="article_comparison" data-product-id="${esc(p.id)}" href="${esc(u.href)}">公式通販で条件を確認</a></td></tr>`;}).join('');
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(topic.title)}｜MEAT PLUS</title><meta name="description" content="${esc(topic.intro)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(topic.title)}"><meta property="og:description" content="${esc(topic.intro)}"><meta property="og:url" content="${url}"><link rel="stylesheet" href="../../assets/style.css"><style>.editorial-content{display:block;max-width:960px;margin:auto;padding:32px 24px 56px}.editorial-content h1{font-size:clamp(1.65rem,3vw,2.3rem);line-height:1.5;margin:0 0 20px}.editorial-content h2{font-size:clamp(1.25rem,2vw,1.6rem);line-height:1.5;margin:0 0 14px}.editorial-content p{margin:12px 0;line-height:1.9}.editorial-content section{margin:32px 0}.editorial-content td,.editorial-content th{padding:12px 10px;border-bottom:1px solid #ded4c9;vertical-align:top;min-width:90px}.editorial-content th:first-child{min-width:180px}.editorial-content details{margin:12px 0;padding:14px;border:1px solid #ded4c9}.editorial-content summary{cursor:pointer;font-weight:700}</style><script type="application/ld+json">${ld(schema)}</script><script async src="https://www.googletagmanager.com/gtag/js?id=G-6WW5KF32KS"></script><script defer src="../../assets/guide-analytics.js"></script></head><body class="editorial-page"><header class="site-header"><a class="brand" href="../../">MEAT PLUS</a><span>商品選びのガイド</span></header><main><nav class="breadcrumb"><a href="../../">商品ガイド</a><span>／</span><span>選び方</span></nav><article><section class="catalog editorial-content"><h1>${esc(topic.title)}</h1><p>${esc(topic.intro)}</p><p>情報提供：<a href="../../about/">株式会社MEATPLUS</a>　記事更新：<time datetime="${modified}">${modified}</time></p><nav aria-label="この記事の目次"><ul>${topic.sections.map(([h],i)=>`<li><a href="#section-${i+1}">${esc(h)}</a></li>`).join('')}</ul></nav>${topic.sections.map(([h,p],i)=>`<section id="section-${i+1}"><h2>${esc(h)}</h2><p>${esc(p)}</p></section>`).join('')}${topic.sources?.length?`<section><h2>参考資料</h2><ul>${topic.sources.map(([name,href])=>`<li><a href="${esc(href)}">${esc(name)}</a></li>`).join('')}</ul><p>一般的な食品の取り扱いは上記の公的資料を参照しています。商品固有の条件は、商品の表示・案内を確認してください。</p></section>`:''}<section><h2>MEAT PLUSの掲載商品を比較する</h2><p>公式商品ガイドの掲載情報を比較しています。価格・在庫・送料・包装条件は、購入先の最新表示をご確認ください。</p><div style="overflow-x:auto"><table style="width:100%;text-align:left"><thead><tr><th scope="col">商品</th><th scope="col">内容量・規格</th><th scope="col">保存方法</th><th scope="col">購入条件</th></tr></thead><tbody>${table}</tbody></table></div></section><section><h2>よくある質問</h2>${topic.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section><p>商品ごとの仕様は、上表の商品情報ページと公式通販を出典としています。本記事の選び方は確認項目の案内であり、未掲載の品質・調理条件・贈答対応を保証するものではありません。</p>${topic.guide?`<p><a href="../../guides/${topic.guide}/">用途別の商品一覧を見る</a></p>`:''}</section></article></main><footer><a href="../../">商品ガイドTOP</a><a href="../../about/">運営者・情報更新方針</a></footer></body></html>`;
  const dir=`articles/${topic.slug}`;await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/index.html',html);
 }
 // Remove only this generator's retired topics, never unrelated editorial pages.
 for(const topic of topics)if(!state[topic.slug])await fs.rm(`articles/${topic.slug}`,{recursive:true,force:true});
 for(const p of products){const file=`products/${p.id}/index.html`;let html=await fs.readFile(file,'utf8');html=html.replace(/<section class="info" data-editorial-links>[\s\S]*?<\/section>/g,'');const relevant=active.filter(a=>a.rows.some(r=>r.id===p.id));if(relevant.length)html=html.replace('</main>',`<section class="info" data-editorial-links><div><h2>購入前に読みたい選び方</h2>${relevant.map(a=>`<p><a href="${site}/articles/${a.topic.slug}/">${esc(a.topic.title)}</a></p>`).join('')}</div></section></main>`);await fs.writeFile(file,html);}
 for(const slug of await fs.readdir('guides')){const file=`guides/${slug}/index.html`;let html=await fs.readFile(file,'utf8');html=html.replace(/<section class="catalog" data-editorial-links>[\s\S]*?<\/section>/g,'');const relevant=active.filter(a=>a.topic.guide===slug);if(relevant.length)html=html.replace('</main>',`<section class="catalog" data-editorial-links><h2>選び方を詳しく読む</h2>${relevant.map(a=>`<p><a href="${site}/articles/${a.topic.slug}/">${esc(a.topic.title)}</a></p>`).join('')}</section></main>`);await fs.writeFile(file,html);}
 let home=await fs.readFile('index.html','utf8');home=home.replace(/<nav data-editorial-nav[\s\S]*?<\/nav>/g,'');if(active.length)home=home.replace('</main>',`<nav data-editorial-nav class="section-nav" aria-label="商品選びの記事">${active.map(a=>`<a href="${site}/articles/${a.topic.slug}/">${esc(a.topic.title)}</a>`).join('')}</nav></main>`);await fs.writeFile('index.html',home);
 let sitemap=await fs.readFile('sitemap.xml','utf8');for(const t of topics)sitemap=sitemap.replace(new RegExp('<url><loc>'+site+'/articles/'+t.slug+'/</loc>[\\s\\S]*?</url>\\s*','g'),'');sitemap=sitemap.replace('</urlset>',active.map(a=>`<url><loc>${site}/articles/${a.topic.slug}/</loc><lastmod>${a.modified}</lastmod></url>`).join('\n')+'\n</urlset>');await fs.writeFile('sitemap.xml',sitemap);
 let llms=await fs.readFile('llms.txt','utf8');llms=llms.replace(/\n## 商品選びの記事[\s\S]*$/,'');if(active.length)llms+='\n## 商品選びの記事\n'+active.map(a=>`- [${a.topic.title}](${site}/articles/${a.topic.slug}/)`).join('\n')+'\n';await fs.writeFile('llms.txt',llms);
 await fs.writeFile('data/editorial-state.json',JSON.stringify(state,null,2)+'\n');console.log(`Editorial: ${active.length} evidence-linked articles; no AI API calls.`);
}
