import fs from 'node:fs/promises';

const queuePath = 'data/gbp-pending.json';
const mode = process.argv[2] || '';
const idsPath = process.argv[3] || '/tmp/published_product_ids.txt';
const sourcePath = process.argv[4] || '/tmp/published_products_source.json';

const clean = value => String(value ?? '').trim();
const normalizeId = value => clean(value).toLowerCase();
const now = () => new Date().toISOString();

async function readJson(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function readIds(path) {
  try {
    return (await fs.readFile(path, 'utf8'))
      .split(/\r?\n/)
      .map(normalizeId)
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadQueue() {
  const raw = await readJson(queuePath, { version: 1, products: [] });
  const products = Array.isArray(raw) ? raw : raw.products;
  return Array.isArray(products) ? products : [];
}

async function saveQueue(products) {
  const payload = {
    version: 1,
    updatedAt: now(),
    products: products
      .map(product => ({
        id: normalizeId(product.id || product.productId),
        productName: clean(product.productName || product.name),
        googleBusinessPost: clean(product.googleBusinessPost),
        queuedAt: clean(product.queuedAt) || now(),
        sourceUpdatedAt: clean(product.sourceUpdatedAt || product.updatedAt)
      }))
      .filter(product => product.id && product.googleBusinessPost)
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id))
  };
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(queuePath, JSON.stringify(payload, null, 2) + '\n');
}

if (mode === 'enqueue') {
  const ids = [...new Set(await readIds(idsPath))];
  if (!ids.length) {
    console.log('GBP queue: no newly published product IDs.');
    process.exit(0);
  }

  const source = await readJson(sourcePath, []);
  if (!Array.isArray(source)) throw new Error('GBP queue: source product file must contain an array.');

  const sourceMap = new Map(
    source
      .map(product => [normalizeId(product.id || product.productId), product])
      .filter(([id]) => id)
  );
  const queue = await loadQueue();
  const queueMap = new Map(queue.map(product => [normalizeId(product.id || product.productId), product]));

  for (const id of ids) {
    const product = sourceMap.get(id);
    if (!product) throw new Error(`GBP queue: ${id} was published but is missing from source product data.`);
    const googleBusinessPost = clean(product.googleBusinessPost);
    if (!googleBusinessPost) throw new Error(`GBP queue: ${id} is missing googleBusinessPost.`);
    const previous = queueMap.get(id);
    queueMap.set(id, {
      id,
      productName: clean(product.productName || product.name),
      googleBusinessPost,
      queuedAt: clean(previous?.queuedAt) || now(),
      sourceUpdatedAt: clean(product.updatedAt)
    });
  }

  await saveQueue([...queueMap.values()]);
  console.log(`GBP queue: queued ${ids.length} published product(s).`);
  process.exit(0);
}

if (mode === 'prepare') {
  const queue = await loadQueue();
  const ids = queue.map(product => normalizeId(product.id || product.productId)).filter(Boolean);
  await fs.writeFile(idsPath, ids.join('\n') + (ids.length ? '\n' : ''));
  const source = queue.map(product => ({
    id: normalizeId(product.id || product.productId),
    productId: normalizeId(product.id || product.productId),
    productName: clean(product.productName || product.name),
    googleBusinessPost: clean(product.googleBusinessPost),
    updatedAt: clean(product.sourceUpdatedAt)
  }));
  await fs.writeFile(sourcePath, JSON.stringify(source, null, 2) + '\n');
  console.log(`GBP queue: prepared ${ids.length} pending product(s).`);
  process.exit(0);
}

if (mode === 'clear') {
  const completed = new Set(await readIds(idsPath));
  if (!completed.size) {
    console.log('GBP queue: no completed IDs to clear.');
    process.exit(0);
  }
  const queue = await loadQueue();
  const remaining = queue.filter(product => !completed.has(normalizeId(product.id || product.productId)));
  await saveQueue(remaining);
  console.log(`GBP queue: cleared ${queue.length - remaining.length} completed product(s); ${remaining.length} remain.`);
  process.exit(0);
}

throw new Error('Usage: node scripts/gbp-queue.mjs <enqueue|prepare|clear> [idsPath] [sourcePath]');
