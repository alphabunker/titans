import test from 'node:test';
import assert from 'node:assert/strict';
import { CIP68_USER_LABEL_PREFIX, COLLECTION_POLICY_ID, CONTRACT_VERSION } from '../src/contracts.js';
import { D1CanonicalRepository } from '../src/storage/d1-repository.js';
import { R2SnapshotStore } from '../src/storage/r2-snapshot-store.js';

const rawAssetNameHex = `${CIP68_USER_LABEL_PREFIX}${Buffer.from('HouseOfTitans0001').toString('hex')}`;
const asset = {
  contractVersion: CONTRACT_VERSION, policyId: COLLECTION_POLICY_ID,
  assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`, referenceAssetId: null,
  rawAssetNameHex, rawAssetName: 'HouseOfTitans0001', displayName: 'Titan One', number: 1, numberSource: 'asset-name',
  metadataStandard: 'CIP-68', cip68Label: 222, imageUri: 'ipfs://cid', imageCid: 'cid',
  traits: [{ category: 'Class', value: 'Royal', normalizedCategory: 'class', normalizedValue: 'royal' }],
  metadataHash: `sha256:${'a'.repeat(64)}`, normalizationVersion: '1.0.0',
  source: { provider: 'koios', retrievedAt: '2026-10-17T18:00:00.000Z', blockHeight: null, blockTime: null },
};

class FakeStatement {
  constructor(sql, database) { this.sql = sql; this.database = database; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { this.database.runs.push(this); return { success: true }; }
  async all() { return { results: this.database.rows }; }
}
class FakeD1 {
  constructor() { this.runs = []; this.batches = []; this.rows = []; }
  prepare(sql) { return new FakeStatement(sql, this); }
  async batch(statements) { this.batches.push(statements); return statements.map(() => ({ success: true })); }
}
class FakeR2Object {
  constructor(bytes) { this.bytes = bytes; }
  async arrayBuffer() { return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength); }
}
class FakeR2 {
  constructor() { this.objects = new Map(); this.failOn = null; }
  async put(key, bytes, options) {
    if (key === this.failOn) throw new Error('simulated R2 failure');
    this.objects.set(key, { bytes: new Uint8Array(bytes), options });
  }
  async get(key) { const value = this.objects.get(key); return value ? new FakeR2Object(value.bytes) : null; }
}

test('D1 repository batches an asset, replacement traits, and source lineage', async () => {
  const database = new FakeD1();
  const repository = new D1CanonicalRepository(database);
  await repository.upsertAsset(asset, 'snapshot-1', '2026-10-17T18:05:00.000Z');
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0].length, 4);
  assert.match(database.batches[0][0].sql, /ON CONFLICT\(asset_id\)/);
  assert.match(database.batches[0][1].sql, /DELETE FROM asset_traits/);
  assert.match(database.batches[0][3].sql, /metadata_sources/);
});

test('D1 repository exposes prior metadata hashes and active pointer mutation', async () => {
  const database = new FakeD1();
  database.rows = [{ asset_id: asset.assetId, metadata_hash: asset.metadataHash }];
  const repository = new D1CanonicalRepository(database);
  assert.deepEqual(await repository.metadataHashes(), new Map([[asset.assetId, asset.metadataHash]]));
  await repository.activateSnapshot({ snapshotId: 'snapshot-1', manifestKey: 'manifest', contentHash: asset.metadataHash, activatedAt: '2026-10-17T18:00:00.000Z', runId: 'run-1' });
  assert.match(database.runs[0].sql, /active_snapshot/);
});

function publishable(count = 6500) {
  const assets = Array.from({ length: count }, (_, index) => ({
    ...asset,
    assetId: `${COLLECTION_POLICY_ID}${CIP68_USER_LABEL_PREFIX}${(index + 1).toString(16).padStart(8, '0')}`,
    rawAssetNameHex: `${CIP68_USER_LABEL_PREFIX}${(index + 1).toString(16).padStart(8, '0')}`,
    number: index + 1,
  }));
  const snapshot = { contractVersion: CONTRACT_VERSION, snapshotId: 'snapshot-1', publishedAt: '2026-10-17T18:00:00.000Z', policyId: COLLECTION_POLICY_ID, expectedCount: 6500, assets };
  const report = { contractVersion: CONTRACT_VERSION, reportId: 'report-1', snapshotId: 'snapshot-1', createdAt: '2026-10-17T18:00:00.000Z', status: 'valid', checks: [{ name: 'all', status: 'pass', message: 'All checks passed.' }] };
  const run = { contractVersion: CONTRACT_VERSION, runId: 'run-1', mode: 'bootstrap', provider: 'koios', startedAt: '2026-10-17T17:00:00.000Z', completedAt: '2026-10-17T18:00:00.000Z', status: 'succeeded', counts: { discovered: count, fetched: count, normalized: count, changed: count, warnings: 0, errors: 0 } };
  return { snapshot, report, run };
}

test('R2 publication writes immutable artifacts before activating latest', async () => {
  const bucket = new FakeR2();
  const store = new R2SnapshotStore(bucket, { now: () => new Date('2026-10-17T18:05:00.000Z') });
  const result = await store.publish({ ...publishable(), normalizationVersion: '1.0.0' });
  assert.equal(result.pointer.snapshotId, 'snapshot-1');
  assert.ok(bucket.objects.has('snapshots/snapshot-1/collection.json'));
  assert.ok(bucket.objects.has('snapshots/snapshot-1/manifest.json'));
  assert.ok(bucket.objects.has('latest.json'));
  assert.equal(result.manifest.actualCount, 6500);
});

test('R2 publication failure cannot replace the active pointer', async () => {
  const bucket = new FakeR2();
  const store = new R2SnapshotStore(bucket, { now: () => new Date('2026-10-17T18:05:00.000Z') });
  await store.putJson('latest.json', { snapshotId: 'prior' });
  bucket.failOn = 'snapshots/snapshot-1/validation-report.json';
  await assert.rejects(() => store.publish({ ...publishable(), normalizationVersion: '1.0.0' }), /simulated R2 failure/);
  assert.equal((await store.getJson('latest.json')).snapshotId, 'prior');
});

test('R2 rollback verifies the prior manifest before changing latest', async () => {
  const bucket = new FakeR2();
  const store = new R2SnapshotStore(bucket, { now: () => new Date('2026-10-17T18:10:00.000Z') });
  const published = await store.publish({ ...publishable(), normalizationVersion: '1.0.0' });
  await store.putJson('latest.json', { ...published.pointer, snapshotId: 'newer' });
  const restored = await store.rollback(published.pointer);
  assert.equal(restored.snapshotId, 'snapshot-1');
  assert.equal((await store.getJson('latest.json')).snapshotId, 'snapshot-1');
});
