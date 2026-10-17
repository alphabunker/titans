import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_POLICY_ID } from '../src/contracts.js';
import { CIP67_LABEL_PREFIXES } from '../src/metadata-normalizer.js';
import { KoiosProvider, koiosRowToEvidence, referenceAssetName, sha256Json } from '../src/providers/koios.js';

const payloadHex = Buffer.from('HouseOfTitans0597').toString('hex');
const userName = `${CIP67_LABEL_PREFIXES[222]}${payloadHex}`;
const referenceName = `${CIP67_LABEL_PREFIXES[100]}${payloadHex}`;
const datum = { constructor: 0, fields: [{ map: [
  { k: { bytes: Buffer.from('name').toString('hex') }, v: { bytes: Buffer.from('Joralon Vaerion').toString('hex') } },
  { k: { bytes: Buffer.from('image').toString('hex') }, v: { bytes: Buffer.from('ipfs://bafy-example').toString('hex') } },
] }] };

const response = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: key => headers[key.toLowerCase()] ?? null },
  async json() { return body; },
});

test('Koios policy pagination returns only CIP-68 user tokens', async () => {
  const calls = [];
  const provider = new KoiosProvider({ fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return response([
      { asset_name: referenceName },
      { asset_name: userName },
    ]);
  }, retries: 0 });
  const result = await provider.listPolicyAssets({ cursor: '0', limit: 2 });
  assert.deepEqual(result.assets, [{ assetId: `${COLLECTION_POLICY_ID}${userName}`, rawAssetNameHex: userName }]);
  assert.equal(result.nextCursor, '2');
  assert.match(calls[0].url, /policy_asset_list/);
  assert.match(calls[0].url, /_asset_policy=/);
  assert.match(calls[0].url, /order=asset_name\.asc/);
});

test('Koios bulk request uses the documented nested asset list body', async () => {
  let request;
  const provider = new KoiosProvider({ fetchImpl: async (url, init) => { request = { url, init }; return response([]); }, retries: 0 });
  await provider.fetchAssetMetadata([{ assetId: `${COLLECTION_POLICY_ID}${userName}`, rawAssetNameHex: userName }]);
  assert.equal(request.url, 'https://api.koios.rest/api/v1/asset_info');
  assert.deepEqual(JSON.parse(request.init.body), { _asset_list: [[COLLECTION_POLICY_ID, userName]] });
});

test('Koios retries rate limits and sends an optional bearer token', async () => {
  let attempts = 0;
  const waits = [];
  const provider = new KoiosProvider({
    apiToken: 'test-token', retries: 1, retryBaseMs: 1,
    sleepImpl: async value => waits.push(value),
    fetchImpl: async (url, init) => {
      attempts += 1;
      assert.equal(init.headers.authorization, 'Bearer test-token');
      return attempts === 1 ? response({}, 429, { 'retry-after': '2' }) : response([]);
    },
  });
  await provider.listPolicyAssets({ limit: 1 });
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [2000]);
});

test('Koios evidence resolves label 222 and its reference-token identity', () => {
  const row = { policy_id: COLLECTION_POLICY_ID, asset_name: userName, cip68_metadata: { 222: datum }, creation_time: 1_700_000_000 };
  const evidence = koiosRowToEvidence(row, '2026-10-17T18:00:00.000Z');
  assert.equal(evidence.assetId, `${COLLECTION_POLICY_ID}${userName}`);
  assert.equal(evidence.referenceAssetId, `${COLLECTION_POLICY_ID}${referenceName}`);
  assert.deepEqual(evidence.metadata, { name: 'Joralon Vaerion', image: 'ipfs://bafy-example' });
  assert.match(evidence.metadataHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(referenceAssetName(userName), referenceName);
});

test('stable JSON hashing is independent of object key order', () => {
  assert.equal(sha256Json({ a: 1, b: 2 }), sha256Json({ b: 2, a: 1 }));
});

test('Koios holdings resolves a payment address to all account addresses and filters to Titan user tokens', async () => {
  const paymentAddress = 'addr1qy2jt0qpqz2z2z9zx5w4xemekkce7yderz53kjue53lpqv90lkfa9sgrfjuz6uvt4uqtrqhl2kj0a9lnr9ndzutx32gqleeckv';
  const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
  const calls = [];
  const provider = new KoiosProvider({ retries: 0, fetchImpl: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith('/address_info')) return response([{ address: paymentAddress, stake_address: stakeAddress }]);
    if (url.endsWith('/account_addresses')) return response([{ stake_address: stakeAddress, addresses: [paymentAddress, paymentAddress] }]);
    return response([
      { address: paymentAddress, policy_id: COLLECTION_POLICY_ID, asset_name: userName, quantity: '1' },
      { address: paymentAddress, policy_id: COLLECTION_POLICY_ID, asset_name: referenceName, quantity: '1' },
      { address: paymentAddress, policy_id: '0'.repeat(56), asset_name: userName, quantity: '1' },
    ]);
  } });
  const result = await provider.fetchAddressAssets([paymentAddress]);
  assert.deepEqual(result.assetIds, [`${COLLECTION_POLICY_ID}${userName}`]);
  assert.equal(result.resolvedAddressCount, 1);
  assert.deepEqual(calls.map(call => call.url.split('/').pop()), ['address_info', 'account_addresses', 'address_assets']);
});

test('Koios holdings treats a valid empty stake account as zero holdings', async () => {
  const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
  const provider = new KoiosProvider({ retries: 0, fetchImpl: async url => {
    assert.match(url, /account_addresses$/);
    return response([]);
  } });
  assert.deepEqual(await provider.fetchAddressAssets([stakeAddress]), { assetIds: [], partial: false, resolvedAddressCount: 0 });
});

test('Koios holdings returns partial results when one resolved-address batch fails', async () => {
  const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';
  const addresses = Array.from({ length: 51 }, (_, index) => `addr1-batch-fixture-${index}`);
  let assetRequests = 0;
  const provider = new KoiosProvider({ retries: 0, fetchImpl: async url => {
    if (url.endsWith('/account_addresses')) return response([{ stake_address: stakeAddress, addresses }]);
    assetRequests += 1;
    if (assetRequests === 2) throw new Error('simulated batch failure');
    return response([{ address: addresses[0], policy_id: COLLECTION_POLICY_ID, asset_name: userName, quantity: '1' }]);
  } });
  const result = await provider.fetchAddressAssets([stakeAddress]);
  assert.equal(result.partial, true);
  assert.deepEqual(result.assetIds, [`${COLLECTION_POLICY_ID}${userName}`]);
});
