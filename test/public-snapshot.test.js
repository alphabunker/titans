import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicCollection, snapshotItems } from '../src/data.js';
import { COLLECTION_POLICY_ID, COLLECTION_SIZE } from '../src/contracts.js';
import { assertPublicCollectionSnapshot } from '../src/public-snapshot.js';
import { loadActivePublicSnapshot } from '../functions/api/collection.js';

const asset = {
  assetId: `${COLLECTION_POLICY_ID}000de14001`,
  displayName: 'Edward North',
  rawAssetName: 'HouseOfTitans0001',
  number: 1,
  metadataStandard: 'CIP-68',
  metadataHash: `sha256:${'a'.repeat(64)}`,
  imageUri: 'ipfs://QmeiC8Hyv8juMEVK5gZHZVcw9VomyLgNGeBh2U6iPLk1eh',
  imageCid: 'QmeiC8Hyv8juMEVK5gZHZVcw9VomyLgNGeBh2U6iPLk1eh',
  traits: { Class: 'Military', House: 'House Of War' },
  source: { provider: 'koios', retrievedAt: '2026-10-17T18:08:44.056Z', blockTime: '2023-09-09T12:12:42.000Z' },
};

const partial = {
  contractVersion: '1.0.0',
  publicSnapshotVersion: '1.0.0',
  snapshotId: 'snapshot-one',
  publishedAt: '2026-10-17T18:08:44.056Z',
  activatedAt: '2026-10-17T18:47:41.068Z',
  policyId: COLLECTION_POLICY_ID,
  expectedCount: COLLECTION_SIZE,
  assetCount: 1,
  status: 'partial',
  assets: [asset],
};

test('public snapshot accepts an explicitly partial state and maps stable explorer identities', () => {
  assert.equal(assertPublicCollectionSnapshot(structuredClone(partial)).status, 'partial');
  assert.deepEqual(snapshotItems(structuredClone(partial)).map(item => ({ id: item.id, name: item.name })), [
    { id: asset.assetId, name: 'Edward North' },
  ]);
});

test('public snapshot rejects a complete label on an incomplete collection and duplicate assets', () => {
  assert.throws(() => assertPublicCollectionSnapshot({ ...structuredClone(partial), status: 'complete' }), /must equal 6500/);
  assert.throws(() => assertPublicCollectionSnapshot({ ...structuredClone(partial), assetCount: 2, assets: [asset, asset] }), /must be unique/);
});

test('public provider rejects HTTP failures and validates successful payloads', async () => {
  await assert.rejects(() => fetchPublicCollection({ fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/);
  const result = await fetchPublicCollection({ fetchImpl: async () => Response.json(partial) });
  assert.equal(result.snapshotId, partial.snapshotId);
});

test('active route rejects a pointer and manifest from different snapshot versions', async () => {
  const objects = new Map([
    ['latest.json', JSON.stringify({ snapshotId: 'one', manifestKey: 'one/manifest.json', contentHash: `sha256:${'a'.repeat(64)}`, activatedAt: partial.activatedAt })],
    ['one/manifest.json', JSON.stringify({ snapshotId: 'two', contentHash: `sha256:${'a'.repeat(64)}`, artifacts: [] })],
  ]);
  const bucket = { async get(key) { return objects.has(key) ? { text: async () => objects.get(key) } : null; } };
  await assert.rejects(() => loadActivePublicSnapshot(bucket), /do not match/);
});
