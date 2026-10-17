export const CONTRACT_VERSION = '1.0.0';
export const COLLECTION_SIZE = 6500;
export const COLLECTION_POLICY_ID = '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad';

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string' && value.length > 0;
const isNullableString = value => value === null || isString(value);
const isIsoDate = value => isString(value) && !Number.isNaN(Date.parse(value));
const isHex = (value, length) => typeof value === 'string' && value.length === length && /^[0-9a-f]+$/i.test(value);
const isAssetId = value => typeof value === 'string'
  && value.startsWith(COLLECTION_POLICY_ID)
  && value.length > COLLECTION_POLICY_ID.length
  && value.length <= COLLECTION_POLICY_ID.length + 64
  && (value.length - COLLECTION_POLICY_ID.length) % 2 === 0
  && /^[0-9a-f]+$/i.test(value);

function requireCondition(condition, path, message) {
  if (!condition) throw new TypeError(`${path}: ${message}`);
}

function validateTraits(traits, path) {
  requireCondition(Array.isArray(traits), path, 'must be an array');
  const identities = new Set();
  traits.forEach((trait, index) => {
    const traitPath = `${path}[${index}]`;
    requireCondition(isRecord(trait), traitPath, 'must be an object');
    requireCondition(isString(trait.category), `${traitPath}.category`, 'must be a non-empty string');
    requireCondition(isString(trait.value), `${traitPath}.value`, 'must be a non-empty string');
    requireCondition(isString(trait.normalizedCategory), `${traitPath}.normalizedCategory`, 'must be a non-empty string');
    requireCondition(isString(trait.normalizedValue), `${traitPath}.normalizedValue`, 'must be a non-empty string');
    const identity = `${trait.category}\u0000${trait.value}`;
    requireCondition(!identities.has(identity), traitPath, 'duplicates a source trait');
    identities.add(identity);
  });
}

/**
 * Validate the stable, provider-independent asset boundary used by storage,
 * snapshots, analytics, and the browser. Raw provider payloads do not belong
 * in this object.
 */
export function assertCanonicalAsset(asset, path = 'asset') {
  requireCondition(isRecord(asset), path, 'must be an object');
  requireCondition(asset.contractVersion === CONTRACT_VERSION, `${path}.contractVersion`, `must equal ${CONTRACT_VERSION}`);
  requireCondition(asset.policyId === COLLECTION_POLICY_ID, `${path}.policyId`, 'must match the verified collection policy');
  requireCondition(isAssetId(asset.assetId), `${path}.assetId`, 'must contain the verified policy plus a bounded even-length hexadecimal asset name');
  requireCondition(isHex(asset.rawAssetNameHex, asset.rawAssetNameHex?.length) && asset.rawAssetNameHex.length % 2 === 0, `${path}.rawAssetNameHex`, 'must be non-empty even-length hexadecimal');
  requireCondition(isString(asset.displayName), `${path}.displayName`, 'must be a non-empty string');
  requireCondition(Number.isSafeInteger(asset.number) && asset.number > 0, `${path}.number`, 'must be a positive safe integer');
  requireCondition(asset.metadataStandard === 'CIP-68', `${path}.metadataStandard`, 'must equal CIP-68');
  requireCondition(Number.isSafeInteger(asset.cip68Label) && asset.cip68Label >= 0, `${path}.cip68Label`, 'must be a non-negative integer');
  requireCondition(isNullableString(asset.imageUri), `${path}.imageUri`, 'must be null or a non-empty string');
  requireCondition(isNullableString(asset.imageCid), `${path}.imageCid`, 'must be null or a non-empty string');
  requireCondition(isString(asset.metadataHash), `${path}.metadataHash`, 'must be a non-empty string');
  requireCondition(isString(asset.normalizationVersion), `${path}.normalizationVersion`, 'must be a non-empty string');
  requireCondition(isRecord(asset.source), `${path}.source`, 'must be an object');
  requireCondition(isString(asset.source.provider), `${path}.source.provider`, 'must be a non-empty string');
  requireCondition(isIsoDate(asset.source.retrievedAt), `${path}.source.retrievedAt`, 'must be an ISO-compatible timestamp');
  validateTraits(asset.traits, `${path}.traits`);
  return asset;
}

export function assertCollectionSnapshot(snapshot) {
  requireCondition(isRecord(snapshot), 'snapshot', 'must be an object');
  requireCondition(snapshot.contractVersion === CONTRACT_VERSION, 'snapshot.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(snapshot.snapshotId), 'snapshot.snapshotId', 'must be a non-empty string');
  requireCondition(isIsoDate(snapshot.publishedAt), 'snapshot.publishedAt', 'must be an ISO-compatible timestamp');
  requireCondition(snapshot.policyId === COLLECTION_POLICY_ID, 'snapshot.policyId', 'must match the verified collection policy');
  requireCondition(Number.isSafeInteger(snapshot.expectedCount) && snapshot.expectedCount === COLLECTION_SIZE, 'snapshot.expectedCount', `must equal ${COLLECTION_SIZE}`);
  requireCondition(Array.isArray(snapshot.assets), 'snapshot.assets', 'must be an array');
  const ids = new Set();
  snapshot.assets.forEach((asset, index) => {
    assertCanonicalAsset(asset, `snapshot.assets[${index}]`);
    requireCondition(!ids.has(asset.assetId), `snapshot.assets[${index}].assetId`, 'must be unique');
    ids.add(asset.assetId);
  });
  return snapshot;
}

export function assertAnalyticsSnapshot(analytics) {
  requireCondition(isRecord(analytics), 'analytics', 'must be an object');
  requireCondition(analytics.contractVersion === CONTRACT_VERSION, 'analytics.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(analytics.snapshotId), 'analytics.snapshotId', 'must be a non-empty string');
  requireCondition(isString(analytics.rulesVersion), 'analytics.rulesVersion', 'must be a non-empty string');
  requireCondition(isRecord(analytics.traitFrequencies), 'analytics.traitFrequencies', 'must be an object');
  requireCondition(isRecord(analytics.pairFrequencies), 'analytics.pairFrequencies', 'must be an object');
  requireCondition(isRecord(analytics.indexes), 'analytics.indexes', 'must be an object');
  return analytics;
}

export function assertPortfolioResponse(portfolio) {
  requireCondition(isRecord(portfolio), 'portfolio', 'must be an object');
  requireCondition(portfolio.contractVersion === CONTRACT_VERSION, 'portfolio.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(portfolio.network === 'mainnet', 'portfolio.network', 'must equal mainnet');
  requireCondition(isIsoDate(portfolio.retrievedAt), 'portfolio.retrievedAt', 'must be an ISO-compatible timestamp');
  requireCondition(['complete', 'partial'].includes(portfolio.status), 'portfolio.status', 'must be complete or partial');
  requireCondition(Array.isArray(portfolio.assetIds), 'portfolio.assetIds', 'must be an array');
  requireCondition(portfolio.assetIds.every(isAssetId), 'portfolio.assetIds', 'must contain only verified-policy hexadecimal asset IDs');
  requireCondition(new Set(portfolio.assetIds).size === portfolio.assetIds.length, 'portfolio.assetIds', 'must not contain duplicates');
  return portfolio;
}

/**
 * @typedef {Object} MetadataProvider
 * @property {(options?: {cursor?: string, limit?: number}) => Promise<{assetIds: string[], nextCursor: string|null}>} listPolicyAssets
 * @property {(assetIds: string[]) => Promise<unknown[]>} fetchAssetMetadata
 * @property {(addresses: string[]) => Promise<{assetIds: string[], partial: boolean}>} fetchAddressAssets
 *
 * Provider implementations translate vendor payloads into importer input. They
 * never return credentials and never become the public browser contract.
 */
