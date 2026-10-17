import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { COLLECTION_POLICY_ID } from '../src/contracts.js';
import { fetchPublicAnalytics } from '../src/data.js';
import { loadActiveAnalytics } from '../functions/api/analytics.js';

const assetId = `${COLLECTION_POLICY_ID}000de14001`;
const traitKey = 'class\u001froyal';
const analytics = {
  contractVersion: '1.0.0',
  snapshotId: 'snapshot-one',
  rulesVersion: '1.1.0',
  generatedAt: '2026-10-17T18:01:00.000Z',
  assetCount: 1,
  traitFrequencies: {
    [traitKey]: { category: 'Class', value: 'Royal', normalizedCategory: 'class', normalizedValue: 'royal', placeholderLike: false, featureExclusions: [], count: 1, percentage: 100, rarityBand: 'common' },
  },
  pairFrequencies: {},
  rarityBands: { common: [traitKey] },
  indexes: {
    assetIds: [assetId],
    traitsByAsset: [[traitKey]],
    byTrait: { [traitKey]: [0] },
    byClass: { royal: [0] },
    pyramid: {},
    miniCollections: {},
  },
};

const analyticsText = JSON.stringify(analytics);
const analyticsHash = `sha256:${createHash('sha256').update(analyticsText).digest('hex')}`;

function bucketFor(value = analyticsText, hash = analyticsHash) {
  const objects = new Map([
    ['latest.json', JSON.stringify({ snapshotId: 'snapshot-one', manifestKey: 'snapshots/snapshot-one/manifest.json', contentHash: 'sha256:canonical' })],
    ['snapshots/snapshot-one/manifest.json', JSON.stringify({ snapshotId: 'snapshot-one', contentHash: 'sha256:canonical', actualCount: 1, artifacts: [{ kind: 'analytics', key: 'snapshots/snapshot-one/analytics.json', sha256: hash }] })],
    ['snapshots/snapshot-one/analytics.json', value],
  ]);
  return { async get(key) { return objects.has(key) ? { text: async () => objects.get(key) } : null; } };
}

test('active analytics route verifies pointer, count, digest, and contract', async () => {
  assert.deepEqual(await loadActiveAnalytics(bucketFor()), analytics);
  await assert.rejects(() => loadActiveAnalytics(bucketFor(analyticsText, 'sha256:wrong')), /digest validation/);
});

test('public analytics provider requires the active collection snapshot identity', async () => {
  const result = await fetchPublicAnalytics({ expectedSnapshotId: 'snapshot-one', fetchImpl: async () => Response.json(analytics) });
  assert.equal(result.snapshotId, 'snapshot-one');
  await assert.rejects(
    () => fetchPublicAnalytics({ expectedSnapshotId: 'another-snapshot', fetchImpl: async () => Response.json(analytics) }),
    /do not match/,
  );
});
