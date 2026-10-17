import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_POLICY_ID,
  CONTRACT_VERSION,
  assertAnalyticsSnapshot,
  assertCanonicalAsset,
  assertCollectionSnapshot,
  assertPortfolioResponse,
} from '../src/contracts.js';

const rawAssetNameHex = Buffer.from('HouseOfTitans0597').toString('hex');
const asset = {
  contractVersion: CONTRACT_VERSION,
  policyId: COLLECTION_POLICY_ID,
  assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`,
  rawAssetNameHex,
  displayName: 'Joralon Vaerion',
  number: 597,
  metadataStandard: 'CIP-68',
  cip68Label: 222,
  imageUri: 'ipfs://bafy-example',
  imageCid: 'bafy-example',
  traits: [{ category: 'Class', value: 'Royal', normalizedCategory: 'class', normalizedValue: 'royal' }],
  metadataHash: 'sha256:example',
  normalizationVersion: '1.0.0',
  source: { provider: 'koios', retrievedAt: '2026-10-17T18:00:00.000Z' },
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
  assert.equal(assertCollectionSnapshot(snapshot), snapshot);
  assert.throws(() => assertCollectionSnapshot({ ...snapshot, assets: [asset, asset] }), /must be unique/);
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

