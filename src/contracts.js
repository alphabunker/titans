export const CONTRACT_VERSION = '1.0.0';
export const COLLECTION_SIZE = 6500;
export const COLLECTION_POLICY_ID = '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad';
export const CIP68_USER_LABEL_PREFIX = '000de140';
export const CIP68_REFERENCE_LABEL_PREFIX = '000643b0';

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string' && value.length > 0;
const isNullableString = value => value === null || isString(value);
const isIsoDate = value => isString(value) && !Number.isNaN(Date.parse(value));
const isNullableIsoDate = value => value === null || isIsoDate(value);
const isNonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const isSha256 = value => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/i.test(value);
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
  requireCondition(asset.assetId === `${asset.policyId}${asset.rawAssetNameHex}`, `${path}.assetId`, 'must equal policyId plus rawAssetNameHex');
  requireCondition(asset.referenceAssetId === null || isAssetId(asset.referenceAssetId), `${path}.referenceAssetId`, 'must be null or a verified-policy hexadecimal asset ID');
  requireCondition(isHex(asset.rawAssetNameHex, asset.rawAssetNameHex?.length) && asset.rawAssetNameHex.length % 2 === 0, `${path}.rawAssetNameHex`, 'must be non-empty even-length hexadecimal');
  requireCondition(asset.rawAssetNameHex.toLowerCase().startsWith(CIP68_USER_LABEL_PREFIX), `${path}.rawAssetNameHex`, 'must use the CIP-68 user-token label');
  if (asset.referenceAssetId !== null) {
    const expectedReference = `${asset.policyId}${CIP68_REFERENCE_LABEL_PREFIX}${asset.rawAssetNameHex.slice(8)}`;
    requireCondition(asset.referenceAssetId === expectedReference, `${path}.referenceAssetId`, 'must identify the paired CIP-68 reference token');
  }
  requireCondition(isNullableString(asset.rawAssetName), `${path}.rawAssetName`, 'must be null or a non-empty string');
  requireCondition(isNullableString(asset.displayName), `${path}.displayName`, 'must be null or a non-empty string');
  requireCondition(asset.number === null || (Number.isSafeInteger(asset.number) && asset.number > 0), `${path}.number`, 'must be null or a positive safe integer');
  requireCondition(['metadata', 'asset-name', null].includes(asset.numberSource), `${path}.numberSource`, 'must be metadata, asset-name, or null');
  requireCondition((asset.number === null) === (asset.numberSource === null), `${path}.numberSource`, 'must be null exactly when number is null');
  requireCondition(asset.metadataStandard === 'CIP-68', `${path}.metadataStandard`, 'must equal CIP-68');
  requireCondition(Number.isSafeInteger(asset.cip68Label) && asset.cip68Label >= 0, `${path}.cip68Label`, 'must be a non-negative integer');
  requireCondition(isNullableString(asset.imageUri), `${path}.imageUri`, 'must be null or a non-empty string');
  requireCondition(isNullableString(asset.imageCid), `${path}.imageCid`, 'must be null or a non-empty string');
  requireCondition(isSha256(asset.metadataHash), `${path}.metadataHash`, 'must be a sha256-prefixed 64-character hexadecimal digest');
  requireCondition(isString(asset.normalizationVersion), `${path}.normalizationVersion`, 'must be a non-empty string');
  requireCondition(isRecord(asset.source), `${path}.source`, 'must be an object');
  requireCondition(isString(asset.source.provider), `${path}.source.provider`, 'must be a non-empty string');
  requireCondition(isIsoDate(asset.source.retrievedAt), `${path}.source.retrievedAt`, 'must be an ISO-compatible timestamp');
  requireCondition(asset.source.blockHeight === null || isNonNegativeInteger(asset.source.blockHeight), `${path}.source.blockHeight`, 'must be null or a non-negative integer');
  requireCondition(isNullableIsoDate(asset.source.blockTime), `${path}.source.blockTime`, 'must be null or an ISO-compatible timestamp');
  validateTraits(asset.traits, `${path}.traits`);
  return asset;
}

export function assertCollectionSnapshot(snapshot, { requireComplete = true } = {}) {
  requireCondition(isRecord(snapshot), 'snapshot', 'must be an object');
  requireCondition(snapshot.contractVersion === CONTRACT_VERSION, 'snapshot.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(snapshot.snapshotId), 'snapshot.snapshotId', 'must be a non-empty string');
  requireCondition(isIsoDate(snapshot.publishedAt), 'snapshot.publishedAt', 'must be an ISO-compatible timestamp');
  requireCondition(snapshot.policyId === COLLECTION_POLICY_ID, 'snapshot.policyId', 'must match the verified collection policy');
  requireCondition(Number.isSafeInteger(snapshot.expectedCount) && snapshot.expectedCount === COLLECTION_SIZE, 'snapshot.expectedCount', `must equal ${COLLECTION_SIZE}`);
  requireCondition(Array.isArray(snapshot.assets), 'snapshot.assets', 'must be an array');
  if (requireComplete) requireCondition(snapshot.assets.length === COLLECTION_SIZE, 'snapshot.assets', `must contain ${COLLECTION_SIZE} assets`);
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
  requireCondition(isIsoDate(analytics.generatedAt), 'analytics.generatedAt', 'must be an ISO-compatible timestamp');
  requireCondition(isNonNegativeInteger(analytics.assetCount), 'analytics.assetCount', 'must be a non-negative integer');
  requireCondition(isRecord(analytics.traitFrequencies), 'analytics.traitFrequencies', 'must be an object');
  requireCondition(isRecord(analytics.pairFrequencies), 'analytics.pairFrequencies', 'must be an object');
  requireCondition(isRecord(analytics.rarityBands), 'analytics.rarityBands', 'must be an object');
  requireCondition(isRecord(analytics.indexes), 'analytics.indexes', 'must be an object');
  return analytics;
}

export function assertIngestionRun(run) {
  requireCondition(isRecord(run), 'run', 'must be an object');
  requireCondition(run.contractVersion === CONTRACT_VERSION, 'run.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(run.runId), 'run.runId', 'must be a non-empty string');
  requireCondition(['bootstrap', 'incremental', 'manual'].includes(run.mode), 'run.mode', 'must be bootstrap, incremental, or manual');
  requireCondition(isString(run.provider), 'run.provider', 'must be a non-empty string');
  requireCondition(isIsoDate(run.startedAt), 'run.startedAt', 'must be an ISO-compatible timestamp');
  requireCondition(isNullableIsoDate(run.completedAt), 'run.completedAt', 'must be null or an ISO-compatible timestamp');
  requireCondition(['pending', 'running', 'succeeded', 'failed'].includes(run.status), 'run.status', 'must be pending, running, succeeded, or failed');
  requireCondition(isRecord(run.counts), 'run.counts', 'must be an object');
  for (const key of ['discovered', 'fetched', 'normalized', 'changed', 'warnings', 'errors']) {
    requireCondition(isNonNegativeInteger(run.counts[key]), `run.counts.${key}`, 'must be a non-negative integer');
  }
  requireCondition(run.status === 'pending' || run.status === 'running' ? run.completedAt === null : isIsoDate(run.completedAt), 'run.completedAt', 'must be present only for a terminal run');
  return run;
}

export function assertValidationReport(report) {
  requireCondition(isRecord(report), 'report', 'must be an object');
  requireCondition(report.contractVersion === CONTRACT_VERSION, 'report.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(report.reportId), 'report.reportId', 'must be a non-empty string');
  requireCondition(isString(report.snapshotId), 'report.snapshotId', 'must be a non-empty string');
  requireCondition(isIsoDate(report.createdAt), 'report.createdAt', 'must be an ISO-compatible timestamp');
  requireCondition(['valid', 'invalid'].includes(report.status), 'report.status', 'must be valid or invalid');
  requireCondition(Array.isArray(report.checks), 'report.checks', 'must be an array');
  report.checks.forEach((check, index) => {
    requireCondition(isRecord(check), `report.checks[${index}]`, 'must be an object');
    requireCondition(isString(check.name), `report.checks[${index}].name`, 'must be a non-empty string');
    requireCondition(['pass', 'warn', 'fail'].includes(check.status), `report.checks[${index}].status`, 'must be pass, warn, or fail');
    requireCondition(isString(check.message), `report.checks[${index}].message`, 'must be a non-empty string');
  });
  const failures = report.checks.filter(check => check.status === 'fail').length;
  requireCondition((report.status === 'invalid') === (failures > 0), 'report.status', 'must be invalid exactly when a check fails');
  return report;
}

export function assertSnapshotManifest(manifest) {
  requireCondition(isRecord(manifest), 'manifest', 'must be an object');
  requireCondition(manifest.contractVersion === CONTRACT_VERSION, 'manifest.contractVersion', `must equal ${CONTRACT_VERSION}`);
  requireCondition(isString(manifest.snapshotId), 'manifest.snapshotId', 'must be a non-empty string');
  requireCondition(isString(manifest.schemaVersion), 'manifest.schemaVersion', 'must be a non-empty string');
  requireCondition(isString(manifest.normalizationVersion), 'manifest.normalizationVersion', 'must be a non-empty string');
  requireCondition(manifest.policyId === COLLECTION_POLICY_ID, 'manifest.policyId', 'must match the verified collection policy');
  requireCondition(manifest.expectedCount === COLLECTION_SIZE, 'manifest.expectedCount', `must equal ${COLLECTION_SIZE}`);
  requireCondition(isNonNegativeInteger(manifest.actualCount), 'manifest.actualCount', 'must be a non-negative integer');
  requireCondition(isIsoDate(manifest.generatedAt), 'manifest.generatedAt', 'must be an ISO-compatible timestamp');
  requireCondition(isSha256(manifest.contentHash), 'manifest.contentHash', 'must be a sha256-prefixed 64-character hexadecimal digest');
  requireCondition(isString(manifest.validationReportId), 'manifest.validationReportId', 'must be a non-empty string');
  requireCondition(Array.isArray(manifest.artifacts), 'manifest.artifacts', 'must be an array');
  manifest.artifacts.forEach((artifact, index) => {
    requireCondition(isRecord(artifact), `manifest.artifacts[${index}]`, 'must be an object');
    requireCondition(isString(artifact.kind), `manifest.artifacts[${index}].kind`, 'must be a non-empty string');
    requireCondition(isString(artifact.key), `manifest.artifacts[${index}].key`, 'must be a non-empty string');
    requireCondition(isSha256(artifact.sha256), `manifest.artifacts[${index}].sha256`, 'must be a sha256-prefixed 64-character hexadecimal digest');
    requireCondition(isNonNegativeInteger(artifact.bytes), `manifest.artifacts[${index}].bytes`, 'must be a non-negative integer');
  });
  return manifest;
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
