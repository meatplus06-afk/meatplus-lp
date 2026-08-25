import fs from 'node:fs/promises';


const publisherPath = 'scripts/auto-publish.mjs';
const gbpPath = 'scripts/google-business-post.mjs';


let publisher = await fs.readFile(publisherPath, 'utf8');
let gbp = await fs.readFile(gbpPath, 'utf8');


const productsAnchor = "const products = Array.isArray(payload.products) ? payload.products : [];";
const productsReplacement = `${productsAnchor}\nconst missingGoogleBusinessPostIds = products.filter(product => !String(product.googleBusinessPost || '').trim()).map(product => String(product.id || product.productId || '(unknown)'));\nif (missingGoogleBusinessPostIds.length) throw new Error('googleBusinessPost is required before LP publication: ' + missingGoogleBusinessPostIds.join(', '));\nawait fs.writeFile('/tmp/published_products_source.json', JSON.stringify(products, null, 2) + '\\n');`;
if (!publisher.includes(productsAnchor)) throw new Error('google-business-copy patch: products anchor not found');
publisher = publisher.replace(productsAnchor, productsReplacement);


const summaryOld = `function makeSummary(product) {\n  const name = clean(product.name || product.productName || product.title || product.id);\n  const description = truncate(product.description || product.metaDescription || product.catchCopy || '', 430);\n  const intro = \`【新着商品】\${name}\`;\n  const detail = description ? \`\\n\\n\${description}\` : '';\n  return \`\${intro}\${detail}\\n\\nMEAT PLUS公式商品ガイドに掲載しました。商品の詳細・ご購入は「詳細」からご覧ください。\\n公式通販：\${shop}\`;\n}`;
const summaryNew = `function makeSummary(product) {\n  const aiCopy = clean(product.googleBusinessPost || '');\n  if (!aiCopy) throw new Error(\`\${product.id || product.productId || 'unknown'}: googleBusinessPost is required; fixed fallback copy is disabled.\`);\n  return truncate(aiCopy, 1200);\n}`;
if (!gbp.includes(summaryOld)) throw new Error('google-business-copy patch: makeSummary anchor not found');
gbp = gbp.replace(summaryOld, summaryNew);


const catalogOld = `const catalog = JSON.parse(await fs.readFile('data/products.json', 'utf8'));\nif (!Array.isArray(catalog)) throw new Error('data/products.json must contain an array.');`;
const catalogNew = `const catalog = JSON.parse(await fs.readFile('data/products.json', 'utf8'));\nif (!Array.isArray(catalog)) throw new Error('data/products.json must contain an array.');\nlet sourceProducts = [];\ntry {\n  sourceProducts = JSON.parse(await fs.readFile('/tmp/published_products_source.json', 'utf8'));\n  if (!Array.isArray(sourceProducts)) sourceProducts = [];\n} catch {\n  sourceProducts = [];\n}`;
if (!gbp.includes(catalogOld)) throw new Error('google-business-copy patch: catalog anchor not found');
gbp = gbp.replace(catalogOld, catalogNew);


const productOld = `  const product = catalog.find(item => clean(item.id || item.productId).toLowerCase() === id);\n  if (!product) throw new Error(\`\${id}: published product was not found in data/products.json.\`);`;
const productNew = `  const catalogProduct = catalog.find(item => clean(item.id || item.productId).toLowerCase() === id);\n  const sourceProduct = sourceProducts.find(item => clean(item.id || item.productId).toLowerCase() === id);\n  if (!catalogProduct && !sourceProduct) throw new Error(\`\${id}: published product was not found in source feed or data/products.json.\`);\n  const product = { ...(catalogProduct || {}), ...(sourceProduct || {}) };`;
if (!gbp.includes(productOld)) throw new Error('google-business-copy patch: product anchor not found');
gbp = gbp.replace(productOld, productNew);


await fs.writeFile(publisherPath, publisher);
await fs.writeFile(gbpPath, gbp);
console.log('Applied Google Business Profile AI-copy handoff support.');

