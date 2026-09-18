import fs from 'node:fs/promises';
import path from 'node:path';

const text = value => String(value ?? '').trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markerPattern = /【(?:商品名案|キャッチコピー|商品説明文|おススメポイント|おすすめポイント|FAQ|商品情報|お客様への一言)】/;

const extractSection = (rawValue, heading, nextHeadings = []) => {
  const raw = text(rawValue);
  const marker = '【' + heading + '】';
  const start = raw.indexOf(marker);
  if (start < 0) return '';
  const from = start + marker.length;
  let end = raw.length;
  for (const next of nextHeadings) {
    const pos = raw.indexOf('【' + next + '】', from);
    if (pos >= 0 && pos < end) end = pos;
  }
  return raw.slice(from, end).trim();
};

const cleanDescription = raw => {
  const source = text(raw);
  if (!source) return '';
  const extracted = extractSection(source, '商品説明文', ['おススメポイント','おすすめポイント','FAQ','商品情報','お客様への一言']);
  return text(extracted || source).replace(/\n{3,}/g, '\n\n');
};

const cleanCatch = raw => {
  const source = text(raw);
  const extracted = extractSection(source, 'キャッチコピー', ['商品説明文','おススメポイント','おすすめポイント','FAQ','商品情報']);
  return text(extracted);
};

const metaFrom = value => text(value).replace(/\s+/g, ' ').slice(0, 150);

const pickScenes = (catchCopy, description) => {
  const sentences = text(description)
    .split(/(?<=[。！？!?])/u)
    .map(text)
    .filter(Boolean);
  const scene1 = text(catchCopy) || sentences[0] || '';
  const rest = sentences.filter(sentence => sentence !== scene1);
  return [
    scene1,
    rest[0] || sentences[1] || scene1,
    rest[1] || sentences[2] || rest[0] || scene1
  ];
};

const jsonScripts = /<script type="application\/ld\+json">([^<]+)<\/script>/g;

const entries = await fs.readdir('products', { withFileTypes: true });
const cleaned = new Map();

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const id = entry.name.toLowerCase();
  const pagePath = path.join('products', entry.name, 'index.html');

  let page;
  try {
    page = await fs.readFile(pagePath, 'utf8');
  } catch {
    continue;
  }

  let productSchema = null;
  page.replace(jsonScripts, (_full, raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.['@type'] === 'Product') productSchema = parsed;
    } catch {}
    return _full;
  });

  const rawDescription = text(productSchema?.description);
  const currentLead = text((page.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || '').replace(/<[^>]+>/g, '');
  const pageHasMarkers = markerPattern.test(page);
  const schemaHasMarkers = markerPattern.test(rawDescription);
  if (!pageHasMarkers && !schemaHasMarkers) continue;

  const description = cleanDescription(rawDescription);
  const catchCopy = cleanCatch(rawDescription) || currentLead.replace(/^【|】$/g, '') || description.split(/(?<=[。！？!?])/u).map(text).find(Boolean) || text(productSchema?.name);
  const meta = metaFrom(description || catchCopy || productSchema?.name);
  const scenes = pickScenes(catchCopy, description);

  page = page.replace(jsonScripts, (full, raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.['@type'] !== 'Product') return full;
      parsed.description = description;
      return '<script type="application/ld+json">' + JSON.stringify(parsed).replace(/</g, '\\u003c') + '</script>';
    } catch {
      return full;
    }
  });

  page = page
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(meta) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(meta) + '">')
    .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(meta) + '">')
    .replace(/<p class="lead">[\s\S]*?<\/p>/, '<p class="lead">' + esc(catchCopy) + '</p>')
    .replace(
      /<details class="product-description"><summary>商品の特徴を読む<\/summary><p>[\s\S]*?<\/p><\/details>/,
      '<details class="product-description"><summary>商品の特徴を読む</summary><p>' + esc(description) + '</p></details>'
    );

  for (let i = 0; i < scenes.length; i += 1) {
    const sceneNumber = String(i + 1).padStart(2, '0');
    const re = new RegExp('(<span>SCENE ' + sceneNumber + '<\\/span><h2>)[\\s\\S]*?(<\\/h2>)');
    page = page.replace(re, '$1' + esc(scenes[i]) + '$2');
  }

  await fs.writeFile(pagePath, page);
  cleaned.set(id, { description, meta, catchCopy });
  console.log('Cleaned legacy generated copy:', id);
}

const updateDataFile = async filePath => {
  let rows;
  try {
    rows = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return;
  }
  if (!Array.isArray(rows)) return;

  let changed = false;
  rows = rows.map(row => {
    const id = text(row.id || row.productId).toLowerCase();
    const clean = cleaned.get(id);
    if (!clean) return row;
    changed = true;
    return { ...row, description: clean.meta };
  });

  if (changed) await fs.writeFile(filePath, JSON.stringify(rows, null, 2) + '\n');
};

await updateDataFile('data/products.json');
await updateDataFile('data/products-public.json');

if (cleaned.size) {
  try {
    let index = await fs.readFile('index.html', 'utf8');
    for (const [id, clean] of cleaned) {
      const escapedId = id.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
      const re = new RegExp(
        '(<a class="card"[^>]*href="\\\\./products/' + escapedId + '/"[^>]*>[\\\\s\\\\S]*?<p class="card-description">)[\\\\s\\\\S]*?(<\\\\/p>)'
      );
      index = index.replace(re, '$1' + esc(clean.meta) + '$2');
    }
    await fs.writeFile('index.html', index);
  } catch {}
}

console.log('Legacy SEO cleanup complete:', cleaned.size, 'page(s).');
