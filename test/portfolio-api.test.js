import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortfolioRequest, takeRateLimit } from '../functions/api/portfolio.js';

const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
const request = address => new Request('https://example.test/api/portfolio', {
  method: 'POST',
  headers: { 'cf-connecting-ip': '192.0.2.1', 'content-type': 'application/json' },
  body: JSON.stringify({ address }),
});
const clock = () => new Date('2026-10-17T20:00:00.000Z');

test('portfolio endpoint caches successful lookups only in ephemeral memory', async () => {
  let calls = 0;
  const provider = { fetchAddressAssets: async () => { calls += 1; return { assetIds: [], partial: false }; } };
  const cache = new Map();
  const allow = () => ({ allowed: true, remaining: 29, resetAt: clock().getTime() + 60_000 });
  const first = await handlePortfolioRequest({ request: request(stakeAddress), provider, cache, rateLimit: allow, now: clock });
  const second = await handlePortfolioRequest({ request: request(stakeAddress), provider, cache, rateLimit: allow, now: clock });
  assert.equal(first.status, 200);
  assert.equal(second.headers.get('x-portfolio-cache'), 'hit');
  assert.equal(calls, 1);
  assert.equal((await second.json()).ownershipProof, false);
});

test('portfolio endpoint distinguishes invalid, wrong-network, timeout, outage, and partial states', async () => {
  const allow = () => ({ allowed: true, remaining: 29, resetAt: clock().getTime() + 60_000 });
  const events = [];
  const logger = { warn: (...values) => events.push(values) };
  const invoke = (address, provider) => handlePortfolioRequest({ request: request(address), provider, cache: new Map(), rateLimit: allow, now: clock, logger });
  const invalid = await invoke('not-an-address', { fetchAddressAssets: async () => ({ assetIds: [], partial: false }) });
  assert.equal((await invalid.json()).error.code, 'invalid_address');
  const wrongNetwork = await invoke('addr_test1qq2jt0qpqz2z2z9zx5w4xemekkce7yderz53kjue53lpqv90lkfa9sgrfjuz6uvt4uqtrqhl2kj0a9lnr9ndzutx32gqu0yc6n', { fetchAddressAssets: async () => ({ assetIds: [], partial: false }) });
  assert.equal((await wrongNetwork.json()).error.code, 'wrong_network');
  const timeout = await invoke(stakeAddress, { fetchAddressAssets: async () => { throw new DOMException('Timed out', 'TimeoutError'); } });
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, 'upstream_timeout');
  const outage = await invoke(stakeAddress, { fetchAddressAssets: async () => { throw new Error('provider down'); } });
  assert.equal(outage.status, 503);
  const partial = await invoke(stakeAddress, { fetchAddressAssets: async () => ({ assetIds: [], partial: true }) });
  assert.equal(partial.status, 206);
  assert.equal((await partial.json()).status, 'partial');
  assert.deepEqual(events, [
    ['Portfolio provider failure', { code: 'upstream_timeout' }],
    ['Portfolio provider failure', { code: 'upstream_unavailable' }],
  ]);
  assert.equal(JSON.stringify(events).includes(stakeAddress), false);
});

test('rate limiter resets its ephemeral bucket and rejects excess traffic', () => {
  const buckets = new Map();
  assert.equal(takeRateLimit('client', { buckets, now: 100, limit: 2, windowMs: 1000 }).allowed, true);
  assert.equal(takeRateLimit('client', { buckets, now: 200, limit: 2, windowMs: 1000 }).allowed, true);
  assert.equal(takeRateLimit('client', { buckets, now: 300, limit: 2, windowMs: 1000 }).allowed, false);
  assert.equal(takeRateLimit('client', { buckets, now: 1200, limit: 2, windowMs: 1000 }).allowed, true);
});

test('portfolio endpoint returns 429 before calling the provider when the client exceeds its allowance', async () => {
  let called = false;
  const response = await handlePortfolioRequest({
    request: request(stakeAddress),
    provider: { fetchAddressAssets: async () => { called = true; return { assetIds: [], partial: false }; } },
    rateLimit: () => ({ allowed: false, remaining: 0, resetAt: clock().getTime() + 60_000 }),
    now: clock,
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(called, false);
});
