import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_POLICY_ID,
  CONTRACT_VERSION,
  CIP68_USER_LABEL_PREFIX,
  assertAnalyticsSnapshot,
  assertCanonicalAsset,
  assertCollectionSnapshot,
  assertIngestionRun,
  assertPortfolioResponse,
  assertSnapshotManifest,
  assertValidationReport,
} from '../src/contracts.js';

const rawAssetNameHex = `${CIP68_USER_LABEL_PREFIX}${Buffer.from('HouseOfTitans0597').toString('hex')}`;
const asset = {
  contractVersion: CONTRACT_VERSION,
  policyId: COLLECTION_POLICY_ID,
  assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`,
  referenceAssetId: null,
  rawAssetNameHex,
  rawAssetName: 'HouseOfTitans0597',
  displayName: 'Joralon Vaerion',
  number: 597,
  numberSource: 'asset-name',
  metadataStandard: 'CIP-68',
  cip68Label: 222,
  imageUri: 'ipfs://bafy-example',
  imageCid: 'bafy-example',
  traits: [{ category: 'Class', value: 'Royal', normalizedCategory: 'class', normalizedValue: 'royal' }],
  metadataHash: `sha256:${'a'.repeat(64)}`,
  normalizationVersion: '1.0.0',
  source: { provider: 'koios', retrievedAt: '2026-10-17T18:00:00.000Z', blockHeight: null, blockTime: null },
};

test('canonical asset accepts the provider-independent CIP-68 shape', () => {
  assert.equal(assertCanonicalAsset(asset), asset);
});

test('canonical asset rejects another policy and duplicate source traits', () => {
  assert.throws(() => assertCanonicalAsset({ ...asset, policyId: '0'.repeat(56) }), /verified collection policy/);
  assert.throws(() => assertCanonicalAsset({ ...asset, traits: [asset.traits[0], asset.traits[0]] }), /duplicates a source trait/);
});

test('collection snapshot enforces identity and unique assets', () => {
  const snapshot = {
    contractVersion: CONTRACT_VERSION,
    snapshotId: '2026-10-17T18:00:00.000Z-example',
    publishedAt: '2026-10-17T18:05:00.000Z',
    policyId: COLLECTION_POLICY_ID,
    expectedCount: 6500,
    assets: [asset],
  };
  assert.equal(assertCollectionSnapshot(snapshot, { requireComplete: false }), snapshot);
  assert.throws(() => assertCollectionSnapshot(snapshot), /must contain 6500 assets/);
  assert.throws(() => assertCollectionSnapshot({ ...snapshot, assets: [asset, asset] }, { requireComplete: false }), /must be unique/);
});

test('analytics contract remains tied to a canonical snapshot and rules version', () => {
  const analytics = {
    contractVersion: CONTRACT_VERSION,
    snapshotId: 'snapshot-1',
    rulesVersion: 'fortress-1',
    traitFrequencies: {},
    pairFrequencies: {},
    indexes: {},
  };
  assert.equal(assertAnalyticsSnapshot(analytics), analytics);
  assert.throws(() => assertAnalyticsSnapshot({ ...analytics, rulesVersion: '' }), /rulesVersion/);
});

test('portfolio contract accepts only unique mainnet collection asset IDs', () => {
  const portfolio = {
    contractVersion: CONTRACT_VERSION,
    network: 'mainnet',
    retrievedAt: '2026-10-17T18:10:00.000Z',
    status: 'complete',
    assetIds: [asset.assetId],
  };
  assert.equal(assertPortfolioResponse(portfolio), portfolio);
  assert.throws(() => assertPortfolioResponse({ ...portfolio, assetIds: [asset.assetId, asset.assetId] }), /duplicates/);
  assert.throws(() => assertPortfolioResponse({ ...portfolio, network: 'preprod' }), /mainnet/);
});

test('ingestion run requires terminal completion timestamps and non-negative counts', () => {
  const run = {
    contractVersion: CONTRACT_VERSION,
    runId: 'run-1', mode: 'bootstrap', provider: 'koios',
    startedAt: '2026-10-17T18:00:00.000Z', completedAt: '2026-10-17T18:05:00.000Z', status: 'succeeded',
    counts: { discovered: 6500, fetched: 6500, normalized: 6500, changed: 6500, warnings: 0, errors: 0 },
  };
  assert.equal(assertIngestionRun(run), run);
  assert.throws(() => assertIngestionRun({ ...run, completedAt: null }), /terminal run/);
});

test('validation report status reflects failing checks', () => {
  const report = {
    contractVersion: CONTRACT_VERSION,
    reportId: 'report-1', snapshotId: 'snapshot-1', createdAt: '2026-10-17T18:00:00.000Z', status: 'valid',
    checks: [{ name: 'expected-count', status: 'pass', message: 'Collection count is valid.' }],
  };
  assert.equal(assertValidationReport(report), report);
  assert.throws(() => assertValidationReport({ ...report, checks: [{ name: 'expected-count', status: 'fail', message: 'Wrong count.' }] }), /status/);
});

test('snapshot manifest validates artifact identity and size', () => {
  const manifest = {
    contractVersion: CONTRACT_VERSION,
    snapshotId: 'snapshot-1', schemaVersion: '1.0.0', normalizationVersion: '1.0.0',
    policyId: COLLECTION_POLICY_ID, expectedCount: 6500, actualCount: 6500,
    generatedAt: '2026-10-17T18:00:00.000Z', contentHash: `sha256:${'b'.repeat(64)}`, validationReportId: 'report-1',
    artifacts: [{ kind: 'canonical', key: 'snapshots/snapshot-1/collection.json', sha256: `sha256:${'c'.repeat(64)}`, bytes: 42 }],
  };
  assert.equal(assertSnapshotManifest(manifest), manifest);
  assert.throws(() => assertSnapshotManifest({ ...manifest, artifacts: [{ ...manifest.artifacts[0], bytes: -1 }] }), /bytes/);
});
