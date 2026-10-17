import { assertAnalyticsSnapshot } from '../../src/contracts.js';

const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...init.headers,
  },
});

async function readJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) throw new TypeError(`Missing snapshot object: ${key}`);
  const text = await object.text();
  return { value: JSON.parse(text), text };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function loadActiveAnalytics(bucket) {
  if (!bucket?.get) throw new TypeError('The SNAPSHOTS R2 binding is required');
  const { value: pointer } = await readJson(bucket, 'latest.json');
  if (!pointer.snapshotId || !pointer.manifestKey || !pointer.contentHash) throw new TypeError('The active snapshot pointer is incomplete');
  const { value: manifest } = await readJson(bucket, pointer.manifestKey);
  if (manifest.snapshotId !== pointer.snapshotId || manifest.contentHash !== pointer.contentHash) throw new TypeError('The active pointer and manifest do not match');
  const artifact = manifest.artifacts?.find(candidate => candidate.kind === 'analytics');
  if (!artifact?.key || !artifact.sha256) throw new TypeError('The analytics artifact is absent');
  const { value: analytics, text } = await readJson(bucket, artifact.key);
  if (analytics.snapshotId !== pointer.snapshotId || analytics.assetCount !== manifest.actualCount || await sha256(text) !== artifact.sha256) {
    throw new TypeError('The analytics artifact failed snapshot, count, or digest validation');
  }
  return assertAnalyticsSnapshot(analytics);
}

export async function onRequestGet({ request, env }) {
  try {
    const cache = caches.default;
    const cacheKey = new Request(new URL('/api/analytics', request.url), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      if (request.headers.get('if-none-match') === cached.headers.get('etag')) return new Response(null, { status: 304, headers: cached.headers });
      return cached;
    }
    const analytics = await loadActiveAnalytics(env.SNAPSHOTS);
    const response = jsonResponse(analytics, {
      headers: {
        'cache-control': CACHE_CONTROL,
        etag: `"${analytics.snapshotId}-${analytics.rulesVersion}"`,
      },
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    console.error('Public analytics unavailable', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Collection analytics are temporarily unavailable.' }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
