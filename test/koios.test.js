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

