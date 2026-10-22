import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthReport, onRequestGet } from '../functions/api/health.js';
import { buildCollectionAnalytics } from '../src/analytics.js';
import { CIP68_USER_LABEL_PREFIX, COLLECTION_POLICY_ID, CONTRACT_VERSION } from '../src/contracts.js';

const digest = `sha256:${'a'.repeat(64)}`;
const rawAssetNameHex = `${CIP68_USER_LABEL_PREFIX}${Buffer.from('HouseOfTitans0001').toString('hex')}`;
const snapshot = {
  contractVersion: CONTRACT_VERSION,
  snapshotId: 'snapshot-health',
  publishedAt: '2026-10-17T12:00:00.000Z',
  policyId: COLLECTION_POLICY_ID,
  expectedCount: 6500,
  assets: [{
    contractVersion: CONTRACT_VERSION,
    policyId: COLLECTION_POLICY_ID,
    assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`,
    referenceAssetId: null,
    rawAssetNameHex,
    rawAssetName: 'HouseOfTitans0001',
    displayName: 'Titan One',
    number: 1,
    numberSource: 'asset-name',
    metadataStandard: 'CIP-68',
    cip68Label: 222,
    imageUri: null,
    imageCid: null,
    traits: [{ category: 'Class', value: 'Royal', normalizedCategory: 'class', normalizedValue: 'royal' }],
    metadataHash: digest,
    normalizationVersion: '1.0.0',
    source: { provider: 'koios', retrievedAt: '2026-10-17T12:00:00.000Z', blockHeight: null, blockTime: null },
  }],
};
const analytics = buildCollectionAnalytics(snapshot);
const manifest = {
  contractVersion: CONTRACT_VERSION,
  snapshotId: snapshot.snapshotId,
  schemaVersion: CONTRACT_VERSION,
  normalizationVersion: '1.0.0',
  policyId: snapshot.policyId,
  expectedCount: 6500,
  actualCount: snapshot.assets.length,
  generatedAt: '2026-10-17T12:00:00.000Z',
  contentHash: digest,
  validationReportId: 'report-1',
  artifacts: [
    { kind: 'canonical', key: 'collection.json', sha256: digest, bytes: 1 },
    { kind: 'analytics', key: 'analytics.json', sha256: digest, bytes: 1 },
  ],
};

function bucket(values) {
  return {
    async get(key) {
      if (!(key in values)) return null;
      return { async text() { return JSON.stringify(values[key]); } };
    },
  };
}

test('health reports a fresh, matching active snapshot', async () => {
  const store = bucket({
    'latest.json': { snapshotId: snapshot.snapshotId, manifestKey: 'manifest.json', contentHash: digest, activatedAt: '2026-10-17T12:00:00.000Z' },
    'manifest.json': manifest,
    'analytics.json': analytics,
  });
  const report = await buildHealthReport(store, { now: new Date('2026-10-17T13:00:00.000Z') });
  assert.equal(report.status, 'healthy');
  assert.equal(report.snapshot.assetCount, snapshot.assets.length);
  assert.equal(report.snapshot.rulesVersion, analytics.rulesVersion);
  assert.equal(report.snapshot.stale, false);
});

test('health marks snapshots older than 48 hours degraded', async () => {
  const store = bucket({
    'latest.json': { snapshotId: snapshot.snapshotId, manifestKey: 'manifest.json', contentHash: digest, activatedAt: '2026-10-15T12:00:00.000Z' },
    'manifest.json': manifest,
    'analytics.json': analytics,
  });
  const report = await buildHealthReport(store, { now: new Date('2026-10-17T12:00:00.001Z') });
  assert.equal(report.status, 'degraded');
  assert.equal(report.snapshot.stale, true);
});

test('health endpoint fails closed without exposing internal errors', async () => {
  const events = [];
  const response = await onRequestGet({ env: { SNAPSHOTS: bucket({}) }, logger: { error: (...values) => events.push(values) } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, 'unhealthy');
  assert.match(body.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(body.reason, 'active_snapshot_unavailable');
  assert.equal(events.length, 1);
  assert.equal(JSON.stringify(body).includes('latest.json'), false);
});
