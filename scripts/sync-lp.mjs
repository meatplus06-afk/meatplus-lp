import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SITE = "https://meatplus06-afk.github.io/meatplus-lp";
const SHOP = "https://meat-plus.club";
const GA_TAG = "<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-6WW5KF32KS\"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-6WW5KF32KS');</script>";
const feedUrl = process.env.FOOD_EC_MASTER_FEED_URL || "";

if (!feedUrl) {
  console.log("FOOD_EC_MASTER_FEED_URL is not set; keeping the current published site.");
  process.exit(0);
}

const response = await fetch(feedUrl, {
  method: "POST",
  headers: { accept: "application/json" }
});
if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
const payload = await response.json();
const products = Array.isArray(payload) ? payload : payload.products;
if (!Array.isArray(products)) throw new Error("Feed must contain a products array.");
if (!products.length) {
  console.log("No LPs are waiting for publication.");
  process.exit(0);
}

const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cleanId = value => String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
const json = value => JSON.stringify(value).replace(/</g, "\\u003c");
const manifestPath = path.join(ROOT, "data", "products.json");
const list = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const saveImage = async (image, destination) => {
  if (image?.base64) {
    await fs.writeFile(destination, Buffer.from(image.base64, "base64"));
    return;
  }
  const url = typeof image === "string" ? image : image?.url;
  if (!url) throw new Error(`Image data is missing for ${destination}`);
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) throw new Error(`Image download failed: ${imageResponse.status}`);
  await fs.writeFile(destination, Buffer.from(await imageResponse.arrayBuffer()));
};

const imageExtension = image => {
  const type = typeof image === "object" ? image?.mimeType || "" : "";
  const name = typeof image === "object" ? image?.name || "" : "";
  if (type.includes("webp") || /\.webp$/i.test(name)) return "webp";
  if (type.includes("png") || /\.png$/i.test(name)) return "png";
  return "jpg";
};

for (const raw of products) {
  const id = cleanId(raw.productId || raw.sku);
  if (!id || !raw.productName || !raw.purchaseUrl || !raw.images?.productList) {
    console.warn("Skipped an incomplete product", raw.productId || raw.sku || "(no id)");
    continue;
  }
  const imageDir = path.join(ROOT, "assets", "products", id);
  await fs.rm(imageDir, { recursive: true, force: true });
  await fs.mkdir(imageDir, { recursive: true });
  const imageEntries = [["product-list", raw.images.productList], ["sns1", raw.images.sns1], ["sns2", raw.images.sns2], ["sns3", raw.images.sns3]].filter(([,u]) => u);
  const localImages = [];
  for (const [role, image] of imageEntries) {
    const ext = imageExtension(image);
    const file = `${role}.${ext}`;
    await saveImage(image, path.join(imageDir, file));
    localImages.push({ role, file });
  }
  const productImage = localImages.find(x => x.role === "product-list");
  if (!productImage) continue;
  const scenes = localImages.filter(x => x.role.startsWith("sns")).map((x, i) => `
<article class="story-card story-card-${["dark","light","red"][i] || "dark"}">
<img data-image-role="${x.role}" src="../../assets/products/${id}/${x.file}" alt="${esc(raw.productName)}の商品イメージ${i+1}" width="1200" height="1200" loading="lazy">
<div><span>SCENE 0${i+1}</span><h2>${esc(raw.sceneCopies?.[i] || raw.catchCopy || raw.productName)}</h2></div>
</article>`).join("");
  const canonical = `${SITE}/products/${id}/`;
  const buy = new URL(raw.purchaseUrl);
  buy.searchParams.set("utm_source", "github_pages");
  buy.searchParams.set("utm_medium", "referral");
  buy.searchParams.set("utm_campaign", `${id}_lp`);
  const schemaImages = localImages.map(x => `${SITE}/assets/products/${id}/${x.file}`);
  const productSchema = {"@context":"https://schema.org","@type":"Product",name:raw.productName,sku:id,category:raw.category||"",description:raw.description||"",image:schemaImages,brand:{"@type":"Brand","name":"MEAT PLUS"},manufacturer:{"@type":"Organization","name":"株式会社MEATPLUS","url":SHOP}};
  const faq = Array.isArray(raw.faq) ? raw.faq.slice(0,5) : [];
  const faqSchema = {"@context":"https://schema.org","@type":"FAQPage",mainEntity:faq.map(x=>({"@type":"Question",name:x.question,acceptedAnswer:{"@type":"Answer",text:x.answer}}))};
  const info = Object.entries(raw.productInfo || {}).map(([k,v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  const page = `<!doctype html><html lang="ja" data-food-ec-updated-at="${esc(raw.updatedAt || "")}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(raw.productName)}｜MEAT PLUS</title><meta name="description" content="${esc(raw.metaDescription || raw.description || raw.productName)}">
<link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="product"><meta property="og:locale" content="ja_JP"><meta property="og:title" content="${esc(raw.productName)}｜MEAT PLUS">
<meta property="og:description" content="${esc(raw.metaDescription || raw.description || "")}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${schemaImages[0]}"><link rel="stylesheet" href="../../assets/style.css">
<script type="application/ld+json">${json(productSchema)}</script>${faq.length ? `<script type="application/ld+json">${json(faqSchema)}</script>` : ""}
</head><body><header class="site-header"><a class="brand" href="../../">MEAT PLUS</a><span>商品ガイド</span></header><main>
<nav class="breadcrumb"><a href="../../">商品ガイド</a><span>／</span><span>${esc(raw.productName)}</span></nav>
<section class="product-hero"><div class="product-shot"><span class="visual-label">${esc(raw.visualLabel || id.toUpperCase())}</span>
<img class="main-photo" data-image-role="product-list" src="../../assets/products/${id}/${productImage.file}" alt="${esc(raw.productName)}の商品一覧用画像" width="1200" height="1200" fetchpriority="high"></div>
<div class="product-copy"><p class="eyebrow">${esc(raw.category || "MEAT PLUS")}</p><h1>${esc(raw.productName)}</h1><p class="lead">${esc(raw.catchCopy || "")}</p><p>${esc(raw.description || "")}</p>
<a class="cta" href="${esc(buy.toString())}&utm_content=main_cta">公式オンラインショップで商品を見る</a><p class="note">価格・在庫・配送条件は公式オンラインショップでご確認ください。</p></div></section>
${scenes ? `<section class="visual-story" aria-label="${esc(raw.productName)}の魅力">${scenes}</section>` : ""}
${info ? `<section class="info"><div><p class="eyebrow">PRODUCT INFORMATION</p><h2>商品情報</h2></div><dl>${info}</dl></section>` : ""}
${raw.ingredients ? `<section class="ingredients"><h2>原材料</h2><p>${esc(raw.ingredients)}</p></section>` : ""}
${faq.length ? `<section class="faq"><p class="eyebrow">FAQ</p><h2>よくあるご質問</h2>${faq.map(x=>`<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join("")}</section>` : ""}
<section class="closing"><h2>${esc(raw.closingCopy || raw.catchCopy || raw.productName)}</h2><a class="cta" href="${esc(buy.toString())}&utm_content=bottom_cta">公式オンラインショップへ</a></section>
</main><footer><a href="${SHOP}/">MEAT PLUS公式オンラインショップ</a><small>商品ID：${id}　© MEAT PLUS</small></footer></body></html>`;
  await fs.mkdir(path.join(ROOT, "products", id), { recursive: true });
  await fs.writeFile(path.join(ROOT, "products", id, "index.html"), page);
  const item = { id, name: raw.productName, category: raw.category || "", description: raw.cardDescription || raw.description || "", image: `./assets/products/${id}/${productImage.file}`, updatedAt: raw.updatedAt || payload.updatedAt || new Date().toISOString() };
  const existingIndex = list.findIndex(product => product.id === id);
  if (existingIndex === -1) list.push(item);
  else list[existingIndex] = item;
}

list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, JSON.stringify(list, null, 2) + "\n");
const cards = list.map(p => `<a class="card" href="./products/${p.id}/"><img src="${p.image}" alt="${esc(p.name)}" width="800" height="800"><div><p class="eyebrow">${esc(p.category)}</p><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><span class="text-link">詳しく見る →</span></div></a>`).join("\n");
const home = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${GA_TAG}<meta name="google-site-verification" content="yD3iUiPYGMRq4pu3yJcyQ1Lipb_vJWS6tTLWma5pzHE"><title>MEAT PLUS 商品ガイド</title><meta name="description" content="MEAT PLUSの商品を分かりやすく紹介する公式商品ガイドです。"><link rel="canonical" href="${SITE}/"><link rel="stylesheet" href="./assets/style.css"></head><body><header class="site-header"><a class="brand" href="./">MEAT PLUS</a><span>商品ガイド</span></header><main><section class="hero"><p class="eyebrow">MEAT PLUS OFFICIAL GUIDE</p><h1>おいしい時間を、<br>もっと身近に。</h1><p>商品の特徴を確認しながら、公式オンラインショップへ進めます。</p></section><section class="catalog"><h2>商品を探す</h2>${cards}</section></main><footer><a href="${SHOP}/">MEAT PLUS公式オンラインショップ</a><small>© MEAT PLUS</small></footer></body></html>`;
await fs.writeFile(path.join(ROOT, "index.html"), home);
const today = new Date().toISOString().slice(0,10);
const urls = [`<url><loc>${SITE}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`, ...list.map(p=>`<url><loc>${SITE}/products/${p.id}/</loc><lastmod>${String(p.updatedAt).slice(0,10)}</lastmod><priority>1.0</priority></url>`)].join("\n");
await fs.writeFile(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
console.log(`Generated ${list.length} product LP(s).`);
