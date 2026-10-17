import { CardanoAddressError } from '../../src/cardano-address.js';
import { resolvePortfolio } from '../../src/portfolio.js';
import { KoiosProvider } from '../../src/providers/koios.js';

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 250;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;

const responseCache = new Map();
const rateLimitBuckets = new Map();

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...init.headers,
  },
});

export function takeRateLimit(bucketKey, {
  buckets = rateLimitBuckets,
  now = Date.now(),
  limit = RATE_LIMIT_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
} = {}) {
  const current = buckets.get(bucketKey);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(bucketKey, bucket);
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

function readCache(key, cache, now) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value, cache, now) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

function isTimeout(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError' || /timed?\s*out|timeout/i.test(error?.message || '');
}

function errorResponse(code, message, status, { retryable = false, headers = {} } = {}) {
  return jsonResponse({ error: { code, message, retryable } }, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });
}

export async function handlePortfolioRequest({
  request,
  env = {},
  provider,
  cache = responseCache,
  rateLimit = options => takeRateLimit(options.key, options),
  now = () => new Date(),
} = {}) {
  const bucketKey = request.headers.get('cf-connecting-ip') || 'local';
  const rate = rateLimit({ key: bucketKey, now: now().getTime() });
  const rateHeaders = {
    'x-ratelimit-limit': String(RATE_LIMIT_REQUESTS),
    'x-ratelimit-remaining': String(rate.remaining),
    'x-ratelimit-reset': String(Math.ceil(rate.resetAt / 1000)),
  };
  if (!rate.allowed) return errorResponse('rate_limited', 'Too many portfolio requests. Please try again shortly.', 429, {
    retryable: true,
    headers: { ...rateHeaders, 'retry-after': String(Math.max(1, Math.ceil((rate.resetAt - now().getTime()) / 1000))) },
  });

  let submittedAddress;
  try {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new TypeError('JSON required');
    const body = await request.json();
    submittedAddress = body && !Array.isArray(body) ? body.address : null;
  } catch {
    submittedAddress = null;
  }
  if (typeof submittedAddress !== 'string' || !submittedAddress.trim()) {
    return errorResponse('invalid_address', 'Provide one Cardano payment or stake address.', 400, { headers: rateHeaders });
  }

  const cacheKey = submittedAddress.trim().toLowerCase();
  const cached = readCache(cacheKey, cache, now().getTime());
  if (cached) return jsonResponse(cached, {
    headers: { ...rateHeaders, 'cache-control': 'private, max-age=30', 'x-portfolio-cache': 'hit' },
  });

  const holdingsProvider = provider ?? new KoiosProvider({
    baseUrl: env.KOIOS_API_URL || undefined,
    apiToken: env.KOIOS_API_TOKEN,
    retries: 1,
    timeoutMs: 8_000,
  });
  try {
    const portfolio = await resolvePortfolio(submittedAddress, { provider: holdingsProvider, now });
    writeCache(cacheKey, portfolio, cache, now().getTime());
    return jsonResponse(portfolio, {
      status: portfolio.status === 'partial' ? 206 : 200,
      headers: { ...rateHeaders, 'cache-control': 'private, max-age=30', 'x-portfolio-cache': 'miss' },
    });
  } catch (error) {
    if (error instanceof CardanoAddressError) {
      return errorResponse(error.code, error.message, 400, { headers: rateHeaders });
    }
    if (isTimeout(error)) return errorResponse('upstream_timeout', 'The holdings provider timed out.', 504, { retryable: true, headers: rateHeaders });
    return errorResponse('upstream_unavailable', 'The holdings provider is temporarily unavailable.', 503, { retryable: true, headers: rateHeaders });
  }
}

export async function onRequestPost(context) {
  return handlePortfolioRequest(context);
}
