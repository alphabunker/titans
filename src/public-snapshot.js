import {
  COLLECTION_POLICY_ID,
  COLLECTION_SIZE,
  CONTRACT_VERSION,
  assertCollectionSnapshot,
} from './contracts.js';

export const PUBLIC_SNAPSHOT_VERSION = '1.0.0';

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string' && value.length > 0;

function requireCondition(condition, path, message) {
  if (!condition) throw new TypeError(`${path}: ${message}`);
}

export function toPublicCollectionSnapshot(snapshot, { activatedAt = snapshot.publishedAt } = {}) {
  assertCollectionSnapshot(snapshot);
  return {
    contractVersion: CONTRACT_VERSION,
    publicSnapshotVersion: PUBLIC_SNAPSHOT_VERSION,
    snapshotId: snapshot.snapshotId,
    publishedAt: snapshot.publishedAt,
    activatedAt,
    policyId: snapshot.policyId,
    expectedCount: snapshot.expectedCount,
    assetCount: snapshot.assets.length,
    status: 'complete',
    assets: snapshot.assets.map(asset => ({
      assetId: asset.assetId,
      displayName: asset.displayName,
      rawAssetName: asset.rawAssetName,
      number: asset.number,
      metadataStandard: asset.metadataStandard,
      metadataHash: asset.metadataHash,
      imageUri: asset.imageUri,
      imageCid: asset.imageCid,
      traits: Object.fromEntries(asset.traits.map(trait => [trait.category, trait.value])),
      source: {
        provider: asset.source.provider,
        retrievedAt: asset.source.retrievedAt,
        blockTime: asset.source.blockTime,
      },
    })),
  };
}

export function assertPublicCollectionSnapshot(snapshot) {
  requireCondition(isRecord(snapshot), 'snapshot', 'must be an object');
  requireCondition(snapshot.contractVersion === CONTRACT_VERSION, 'snapshot.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(snapshot.publicSnapshotVersion === PUBLIC_SNAPSHOT_VERSION, 'snapshot.publicSnapshotVersion', `must equal ${PUBLIC_SNAPSHOT_VERSION}`);
  requireCondition(isString(snapshot.snapshotId), 'snapshot.snapshotId', 'must be a non-empty string');
  requireCondition(!Number.isNaN(Date.parse(snapshot.publishedAt)), 'snapshot.publishedAt', 'must be an ISO-compatible timestamp');
  requireCondition(!Number.isNaN(Date.parse(snapshot.activatedAt)), 'snapshot.activatedAt', 'must be an ISO-compatible timestamp');
  requireCondition(snapshot.policyId === COLLECTION_POLICY_ID, 'snapshot.policyId', 'must match the verified collection policy');
  requireCondition(snapshot.expectedCount === COLLECTION_SIZE, 'snapshot.expectedCount', `must equal ${COLLECTION_SIZE}`);
  requireCondition(['complete', 'partial'].includes(snapshot.status), 'snapshot.status', 'must be complete or partial');
  requireCondition(Array.isArray(snapshot.assets), 'snapshot.assets', 'must be an array');
  requireCondition(snapshot.assetCount === snapshot.assets.length, 'snapshot.assetCount', 'must equal the asset array length');
  requireCondition(snapshot.assetCount <= COLLECTION_SIZE, 'snapshot.assetCount', `must not exceed ${COLLECTION_SIZE}`);
  if (snapshot.status === 'complete') requireCondition(snapshot.assetCount === COLLECTION_SIZE, 'snapshot.assetCount', `must equal ${COLLECTION_SIZE} when complete`);
  if (snapshot.status === 'partial') requireCondition(snapshot.assetCount < COLLECTION_SIZE, 'snapshot.assetCount', `must be below ${COLLECTION_SIZE} when partial`);

  const assetIds = new Set();
  snapshot.assets.forEach((asset, index) => {
    const path = `snapshot.assets[${index}]`;
    requireCondition(isRecord(asset), path, 'must be an object');
    requireCondition(isString(asset.assetId) && asset.assetId.startsWith(COLLECTION_POLICY_ID), `${path}.assetId`, 'must belong to the verified policy');
    requireCondition(!assetIds.has(asset.assetId), `${path}.assetId`, 'must be unique');
    assetIds.add(asset.assetId);
    requireCondition(asset.displayName === null || isString(asset.displayName), `${path}.displayName`, 'must be null or a non-empty string');
    requireCondition(asset.rawAssetName === null || isString(asset.rawAssetName), `${path}.rawAssetName`, 'must be null or a non-empty string');
    requireCondition(asset.number === null || (Number.isSafeInteger(asset.number) && asset.number > 0), `${path}.number`, 'must be null or a positive integer');
    requireCondition(asset.metadataStandard === 'CIP-68', `${path}.metadataStandard`, 'must equal CIP-68');
    requireCondition(typeof asset.metadataHash === 'string' && /^sha256:[0-9a-f]{64}$/i.test(asset.metadataHash), `${path}.metadataHash`, 'must be a SHA-256 digest');
    requireCondition(asset.imageUri === null || isString(asset.imageUri), `${path}.imageUri`, 'must be null or a non-empty string');
    requireCondition(asset.imageCid === null || isString(asset.imageCid), `${path}.imageCid`, 'must be null or a non-empty string');
    requireCondition(isRecord(asset.traits), `${path}.traits`, 'must be an object');
    Object.entries(asset.traits).forEach(([category, value]) => {
      requireCondition(isString(category) && isString(value), `${path}.traits`, 'must contain non-empty string keys and values');
    });
    requireCondition(isRecord(asset.source), `${path}.source`, 'must be an object');
    requireCondition(isString(asset.source.provider), `${path}.source.provider`, 'must be a non-empty string');
    requireCondition(!Number.isNaN(Date.parse(asset.source.retrievedAt)), `${path}.source.retrievedAt`, 'must be an ISO-compatible timestamp');
    requireCondition(asset.source.blockTime === null || !Number.isNaN(Date.parse(asset.source.blockTime)), `${path}.source.blockTime`, 'must be null or an ISO-compatible timestamp');
  });
  return snapshot;
}

