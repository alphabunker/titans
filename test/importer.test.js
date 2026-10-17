import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_POLICY_ID } from '../src/contracts.js';
import { CIP67_LABEL_PREFIXES } from '../src/metadata-normalizer.js';
import { createMemoryCheckpointStore, runCollectionImport } from '../src/importer.js';

const makeAsset = number => {
  const payload = Buffer.from(`HouseOfTitans${String(number).padStart(4, '0')}`).toString('hex');
  const rawAssetNameHex = `${CIP67_LABEL_PREFIXES[222]}${payload}`;
  return { assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`, rawAssetNameHex };
};
const datum = number => ({ 222: { constructor: 0, fields: [{ map: [
  { k: { bytes: Buffer.from('name').toString('hex') }, v: { bytes: Buffer.from(`Titan ${number}`).toString('hex') } },
  { k: { bytes: Buffer.from('number').toString('hex') }, v: { int: number } },
  { k: { bytes: Buffer.from('Class').toString('hex') }, v: { bytes: Buffer.from('Royal').toString('hex') } },
] }] } });
const row = asset => {
  const number = Number.parseInt(Buffer.from(asset.rawAssetNameHex.slice(8), 'hex').toString().slice(-4), 10);
  return { policy_id: COLLECTION_POLICY_ID, asset_name: asset.rawAssetNameHex, cip68_metadata: datum(number), creation_time: 1_700_000_000 };
};

test('importer discovers pages, normalizes batches, and reports a valid candidate', async () => {
  const assets = [makeAsset(1), makeAsset(2), makeAsset(3)];
  const provider = {
    async listPolicyAssets({ cursor }) {
      const offset = Number(cursor);
      return { assets: assets.slice(offset, offset + 2), nextCursor: offset + 2 < assets.length ? String(offset + 2) : null };
    },
    async fetchAssetMetadata(batch) { return batch.map(row); },
  };
  const progress = [];
  const result = await runCollectionImport({ provider, expectedCount: 3, pageSize: 2, batchSize: 2, runId: 'test', now: () => new Date('2026-10-17T18:00:00.000Z'), onProgress: value => progress.push(value) });
  assert.equal(result.run.status, 'succeeded');
  assert.equal(result.snapshot.assets.length, 3);
  assert.equal(result.run.counts.changed, 3);
  assert.deepEqual(result.snapshot.assets.map(asset => asset.number), [1, 2, 3]);
  assert.ok(progress.some(value => value.phase === 'discovery'));
  assert.ok(progress.some(value => value.phase === 'metadata'));
});

test('importer resumes without fetching already checkpointed assets', async () => {
  const assets = [makeAsset(1), makeAsset(2)];
  const store = createMemoryCheckpointStore();
  let metadataCalls = 0;
  const provider = {
    async listPolicyAssets() { return { assets, nextCursor: null }; },
    async fetchAssetMetadata(batch) {
      metadataCalls += 1;
      if (metadataCalls === 1) return [row(batch[0])];
      return batch.map(row);
    },
  };
  const failed = await runCollectionImport({ provider, checkpointStore: store, expectedCount: 2, batchSize: 2, mode: 'manual', runId: 'first' });
  assert.equal(failed.run.status, 'failed');
  const resumed = await runCollectionImport({ provider, checkpointStore: store, expectedCount: 2, batchSize: 2, mode: 'manual', runId: 'second' });
  assert.equal(resumed.run.status, 'succeeded');
  assert.equal(resumed.snapshot.assets.length, 2);
  assert.equal(metadataCalls, 2);
});

test('importer cannot mark a partial or malformed candidate valid', async () => {
  const asset = makeAsset(1);
  const provider = {
    async listPolicyAssets() { return { assets: [asset], nextCursor: null }; },
    async fetchAssetMetadata() { return [{ policy_id: COLLECTION_POLICY_ID, asset_name: asset.rawAssetNameHex, cip68_metadata: null }]; },
  };
  const result = await runCollectionImport({ provider, expectedCount: 1, runId: 'invalid' });
  assert.equal(result.run.status, 'failed');
  assert.equal(result.report.status, 'invalid');
  assert.equal(result.run.counts.errors, 1);
});
