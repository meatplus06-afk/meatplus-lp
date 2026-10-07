import fs from 'node:fs/promises';
const site='https://meatplus06-afk.github.io/meatplus-lp';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const products=JSON.parse(await fs.readFile('data/products-detailed.json','utf8'));
const product=id=>{const p=products.find(p=>p.id===id);if(!p)throw new Error('Missing homepage product '+id);return p;};
const themes=[
 {slug:'yakiniku',label:'焼肉・ステーキ',copy:'今日は、おうちが焼肉店。',id:'m002',tone:'red'},
 {slug:'sukiyaki',label:'すき焼き・しゃぶしゃぶ',copy:'お鍋を囲んで、ゆっくり。',id:'a003',tone:'yellow'},
 {slug:'nabe',label:'もつ鍋・水炊き',copy:'博多の味で、あったまろう。',id:'i008',tone:'green'},
 {slug:'snacks',label:'おつまみ',copy:'今夜の一杯に、もう一品。',id:'j021',tone:'pink'}
];
const heroProduct=product('m002');
await fs.access('assets/products/m002/sns1.jpg');
const hero=`<section class="hero home-hero"><div class="home-hero-copy"><p class="eyebrow">MEAT PLUS · おいしいを、もっと。</p><h1>今日は、何を<br><span>おいしく</span>しよう？</h1><p class="home-intro">とっておきのお肉も、いつものごはんも。<br>食べたい気分から、食卓の楽しみを見つけよう。</p><div class="home-actions"><a class="home-button" href="#home-scenes">食べたい気分から選ぶ <span>↗</span></a><a class="home-sub-link" href="#catalog">すべての商品を見る ↓</a></div><p class="home-small">黒毛和牛・博多の鍋・海鮮・おやつまで</p></div><a class="home-hero-photo" href="${esc(heroProduct.url)}" aria-label="${esc(heroProduct.name)}を見る"><img src="./assets/products/m002/sns1.jpg" alt="${esc(heroProduct.name)}の紹介ビジュアル" width="1254" height="1254" fetchpriority="high"><span class="home-photo-caption">焼肉の時間を、ちょっと特別に。 <b>商品を見る ↗</b></span></a></section>`;
const scenes=`<section class="home-scenes" id="home-scenes" data-home-scenes><div class="home-section-heading"><div><p class="eyebrow">WHAT'S YOUR MOOD?</p><h2>食べたい気分、どれにする？</h2></div><p>写真から気になるメニューを選んで。<br>内容量・保存方法を比べられます。</p></div><div class="home-scene-grid">${themes.map((t,i)=>`<a class="home-scene ${t.tone}" href="${site}/guides/${t.slug}/"><div><span class="home-scene-number">0${i+1}</span><h3>${esc(t.label)}</h3><p>${esc(t.copy)}</p><span class="home-scene-arrow" aria-hidden="true">↗</span></div><img src="${esc(product(t.id).image)}" alt="${esc(product(t.id).name)}" width="400" height="400" loading="lazy"></a>`).join('')}</div></section>`;
let html=await fs.readFile('index.html','utf8');
html=html.replace(/<body(?: class="[^"]*")?>/,'<body class="home-page">');
html=html.replace(/<script[^>]*src="\.\/assets\/guide-analytics\.js"[^>]*><\/script>/g,'');
html=html.replace(/<link[^>]*href="\.\/assets\/home\.css"[^>]*>/g,'').replace('</head>','<link rel="stylesheet" href="./assets/home.css"><script defer src="./assets/guide-analytics.js"></script></head>');
html=html.replace(/<header class="site-header">[\s\S]*?<\/header>/,`<header class="site-header"><a class="brand" href="./">MEAT PLUS<span>おいしいを、もっと。</span></a><nav aria-label="メインメニュー"><a href="#home-scenes">気分から選ぶ</a><a href="#catalog">商品一覧</a><a class="home-shop-link" href="https://meat-plus.club/">公式通販へ ↗</a></nav></header>`);
html=html.replace(/<section class="hero(?: home-hero)?">[\s\S]*?<\/section>/,hero);
html=html.replace(/<section class="home-scenes"[\s\S]*?<\/section>/g,'');
html=html.replace(/<nav class="section-nav" data-commerce-guides[\s\S]*?<\/nav>/g,'');
html=html.replace(/<nav class="section-nav" data-discovery-categories[\s\S]*?<\/nav>/g,'');
html=html.replace('<section class="catalog" id="catalog">',scenes+'<section class="catalog" id="catalog">');
html=html.replace('<h2>商品を探す</h2>','<h2>次の「おいしい」を見つけよう。</h2>');
await fs.writeFile('index.html',html);
console.log('Built colorful product-led homepage with four purpose entries.');
