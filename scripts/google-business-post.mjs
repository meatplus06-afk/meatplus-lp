import fs from 'node:fs/promises';

const site = 'https://meatplus06-afk.github.io/meatplus-lp';
const shop = 'https://meat-plus.club/';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const postsBase = 'https://mybusiness.googleapis.com/v4';
const accountsBase = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const locationsBase = 'https://mybusinessbusinessinformation.googleapis.com/v1';

const required = ['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required. LP publication is blocked until Google Business Profile authentication is configured.`);
}

const idsFile = process.argv[2] || '/tmp/published_product_ids.txt';
let ids = [];
try {
  ids = (await fs.readFile(idsFile, 'utf8')).split(/\r?\n/).map(v => v.trim().toLowerCase()).filter(Boolean);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!ids.length) {
  console.log('No newly published product LPs; Google Business Profile posting is not required.');
  process.exit(0);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const retryable = new Set([408, 425, 429, 500, 502, 503, 504]);
async function request(url, options = {}, { attempts = 5, label = 'Google API request' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
      if (response.ok) return response;
      const body = await response.text();
      lastError = new Error(`${label} failed (${response.status}): ${body.slice(0, 600)}`);
      if (!retryable.has(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    const delay = 2000 * (2 ** (attempt - 1));
    console.warn(`${label} attempt ${attempt}/${attempts} failed; retrying in ${delay}ms`);
    await sleep(delay);
  }
  throw lastError;
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GBP_CLIENT_ID,
    client_secret: process.env.GBP_CLIENT_SECRET,
    refresh_token: process.env.GBP_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  const response = await request(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  }, { attempts: 3, label: 'OAuth token refresh' });
  const data = await response.json();
  if (!data.access_token) throw new Error('Google OAuth token response did not include access_token.');
  return data.access_token;
}

async function jsonRequest(url, token, options = {}, config = {}) {
  const response = await request(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  }, config);
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

const stripPrefix = (value, prefix) => String(value || '').replace(new RegExp(`^${prefix}/`), '');

async function resolveTarget(token) {
  let accountId = process.env.GBP_ACCOUNT_ID?.trim();
  let locationId = process.env.GBP_LOCATION_ID?.trim();
  if (accountId && locationId) return { accountId, locationId };

  const accountsData = await jsonRequest(`${accountsBase}/accounts`, token, {}, { label: 'List GBP accounts' });
  const accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
  if (!accountId) {
    if (accounts.length !== 1) throw new Error(`GBP_ACCOUNT_ID is required because ${accounts.length} accessible Business Profile accounts were found.`);
    accountId = stripPrefix(accounts[0].name, 'accounts');
  }

  if (!locationId) {
    const params = new URLSearchParams({ readMask: 'name,title,storeCode,websiteUri', pageSize: '100' });
    const locationsData = await jsonRequest(`${locationsBase}/accounts/${encodeURIComponent(accountId)}/locations?${params}`, token, {}, { label: 'List GBP locations' });
    const locations = Array.isArray(locationsData.locations) ? locationsData.locations : [];
    if (locations.length !== 1) {
      const choices = locations.map(x => `${x.name || ''} ${x.title || ''}`.trim()).join(' | ');
      throw new Error(`GBP_LOCATION_ID is required because ${locations.length} locations were found. ${choices}`);
    }
    locationId = stripPrefix(locations[0].name, 'locations');
  }
  return { accountId, locationId };
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const truncate = (value, max) => {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};
const absoluteImageUrl = image => {
  const value = clean(image);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value.replace(/^\.\//, ''), `${site}/`).toString();
};

function postUrl(id) {
  const url = new URL(`${site}/products/${id}/`);
  url.searchParams.set('utm_source', 'google_business');
  url.searchParams.set('utm_medium', 'organic');
  url.searchParams.set('utm_campaign', `gbp_${id}`);
  url.searchParams.set('utm_content', 'local_post');
  return url.toString();
}

function makeSummary(product) {
  const name = clean(product.name || product.productName || product.title || product.id);
  const description = truncate(product.description || product.metaDescription || product.catchCopy || '', 430);
  const intro = `【新着商品】${name}`;
  const detail = description ? `\n\n${description}` : '';
  return `${intro}${detail}\n\nMEAT PLUS公式商品ガイドに掲載しました。商品の詳細・ご購入は「詳細」からご覧ください。\n公式通販：${shop}`;
}

async function alreadyPosted(token, parent, campaign) {
  const params = new URLSearchParams({ pageSize: '100' });
  const data = await jsonRequest(`${postsBase}/${parent}/localPosts?${params}`, token, {}, { label: 'List recent GBP posts' });
  const posts = Array.isArray(data.localPosts) ? data.localPosts : [];
  return posts.some(post => {
    const url = String(post.callToAction?.url || '');
    return url.includes(`utm_campaign=${encodeURIComponent(campaign)}`) || url.includes(`utm_campaign=${campaign}`);
  });
}

const catalog = JSON.parse(await fs.readFile('data/products.json', 'utf8'));
if (!Array.isArray(catalog)) throw new Error('data/products.json must contain an array.');

const token = await getAccessToken();
const { accountId, locationId } = await resolveTarget(token);
const parent = `accounts/${accountId}/locations/${locationId}`;

for (const id of ids) {
  const product = catalog.find(item => clean(item.id || item.productId).toLowerCase() === id);
  if (!product) throw new Error(`${id}: published product was not found in data/products.json.`);

  const campaign = `gbp_${id}`;
  if (await alreadyPosted(token, parent, campaign)) {
    console.log(`${id}: Google Business Profile post already exists; skipping duplicate.`);
    continue;
  }

  const targetUrl = postUrl(id);
  const imageUrl = absoluteImageUrl(product.image || product.productListImage || product.imageUrl);
  const payload = {
    languageCode: 'ja',
    summary: makeSummary(product),
    callToAction: { actionType: 'LEARN_MORE', url: targetUrl },
    topicType: 'STANDARD'
  };
  if (imageUrl) payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }];

  const created = await jsonRequest(`${postsBase}/${parent}/localPosts`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, { label: `${id}: Create GBP post` });
  if (!created.name) throw new Error(`${id}: Google Business Profile API returned success without a post resource name.`);
  console.log(`${id}: Google Business Profile post created (${created.name}).`);
}
