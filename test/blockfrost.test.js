import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_POLICY_ID } from '../src/contracts.js';
import { CIP67_LABEL_PREFIXES } from '../src/metadata-normalizer.js';
import { BlockfrostProvider, blockfrostAssetToEvidence } from '../src/providers/blockfrost.js';

const payloadHex = Buffer.from('HouseOfTitans0597').toString('hex');
const userName = `${CIP67_LABEL_PREFIXES[222]}${payloadHex}`;
const referenceName = `${CIP67_LABEL_PREFIXES[100]}${payloadHex}`;
const response = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: key => headers[key.toLowerCase()] ?? null },
  async json() { return body; },
});

test('Blockfrost policy pagination selects CIP-68 user tokens', async () => {
  const calls = [];
  const provider = new BlockfrostProvider({ projectId: 'preview-key', retries: 0, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return response([
      { asset: `${COLLECTION_POLICY_ID}${referenceName}`, quantity: '1' },
      { asset: `${COLLECTION_POLICY_ID}${userName}`, quantity: '1' },
    ]);
  } });
  const result = await provider.listPolicyAssets({ cursor: '1', limit: 2 });
  assert.deepEqual(result.assets, [{ assetId: `${COLLECTION_POLICY_ID}${userName}`, rawAssetNameHex: userName }]);
  assert.equal(result.nextCursor, '2');
  assert.match(calls[0].url, /count=2&page=1&order=asc/);
  assert.equal(calls[0].init.headers.project_id, 'preview-key');
});

test('Blockfrost adapter fetches details and emits provider-independent evidence', async () => {
  const metadata = { name: 'Joralon Vaerion', image: 'ipfs://bafy-example', Class: 'Royal' };
  const provider = new BlockfrostProvider({ projectId: 'preview-key', retries: 0, fetchImpl: async () => response({
    asset: `${COLLECTION_POLICY_ID}${userName}`,
    policy_id: COLLECTION_POLICY_ID,
    asset_name: userName,
    onchain_metadata: metadata,
    onchain_metadata_standard: 'CIP68v3',
  }) });
  const [row] = await provider.fetchAssetMetadata([{ assetId: `${COLLECTION_POLICY_ID}${userName}`, rawAssetNameHex: userName }]);
  const evidence = provider.toEvidence(row, '2026-10-17T18:00:00.000Z');
  assert.equal(evidence.provider, 'blockfrost');
  assert.equal(evidence.referenceAssetId, `${COLLECTION_POLICY_ID}${referenceName}`);
  assert.deepEqual(evidence.metadata, metadata);
});

test('Blockfrost evidence rejects absent or non-CIP-68 metadata', () => {
  assert.throws(() => blockfrostAssetToEvidence({ policy_id: COLLECTION_POLICY_ID, asset_name: userName, onchain_metadata: null }, '2026-10-17T18:00:00.000Z'), /decoded CIP-68/);
  assert.throws(() => blockfrostAssetToEvidence({ policy_id: COLLECTION_POLICY_ID, asset_name: userName, onchain_metadata: {}, onchain_metadata_standard: 'CIP25v2' }, '2026-10-17T18:00:00.000Z'), /unexpected metadata standard/);
});
