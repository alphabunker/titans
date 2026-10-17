import { randomUUID } from 'node:crypto';
import {
  COLLECTION_POLICY_ID,
  COLLECTION_SIZE,
  CONTRACT_VERSION,
  assertIngestionRun,
  assertValidationReport,
} from './contracts.js';
import { normalizeCip68Asset } from './metadata-normalizer.js';
import { koiosRowToEvidence } from './providers/koios.js';

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const terminalCounts = () => ({ discovered: 0, fetched: 0, normalized: 0, changed: 0, warnings: 0, errors: 0 });

export function createMemoryCheckpointStore(initialValue = null) {
  let value = initialValue ? structuredClone(initialValue) : null;
  return {
    async load() { return value ? structuredClone(value) : null; },
    async save(next) { value = structuredClone(next); },
    inspect() { return value ? structuredClone(value) : null; },
  };
}

function freshCheckpoint(mode) {
  return {
    version: 1,
    policyId: COLLECTION_POLICY_ID,
    mode,
    discoveryCursor: '0',
    discoveryComplete: false,
    assets: [],
    processedAssetIds: [],
    records: [],
    errors: [],
  };
}

function validateCheckpoint(checkpoint, mode) {
  if (!checkpoint || checkpoint.version !== 1 || checkpoint.policyId !== COLLECTION_POLICY_ID || checkpoint.mode !== mode) {
    throw new TypeError('Checkpoint is incompatible with this import');
  }
  for (const key of ['assets', 'processedAssetIds', 'records', 'errors']) {
    if (!Array.isArray(checkpoint[key])) throw new TypeError(`Checkpoint ${key} must be an array`);
  }
  return checkpoint;
}

export async function runCollectionImport({
  provider,
  mode = 'manual',
  checkpointStore = createMemoryCheckpointStore(),
  pageSize = 500,
  batchSize = 100,
  expectedCount = COLLECTION_SIZE,
  previousHashes = new Map(),
  now = () => new Date(),
  runId = randomUUID(),
  onProgress = () => {},
} = {}) {
  if (!provider?.listPolicyAssets || !provider?.fetchAssetMetadata) throw new TypeError('A metadata provider is required');
  if (!['bootstrap', 'incremental', 'manual'].includes(mode)) throw new TypeError('Unsupported import mode');
  const startedAt = now().toISOString();
  const loaded = await checkpointStore.load();
  const checkpoint = loaded ? validateCheckpoint(loaded, mode) : freshCheckpoint(mode);
  // Errors describe the current attempt. Failed assets remain unprocessed and
  // are retried on resume, while the prior terminal report preserves history.
  checkpoint.errors = [];

  if (!checkpoint.discoveryComplete) {
    while (checkpoint.discoveryCursor !== null) {
      const page = await provider.listPolicyAssets({ cursor: checkpoint.discoveryCursor, limit: pageSize });
      const known = new Set(checkpoint.assets.map(asset => asset.assetId));
      for (const asset of page.assets) if (!known.has(asset.assetId)) checkpoint.assets.push(asset);
      checkpoint.discoveryCursor = page.nextCursor;
      checkpoint.discoveryComplete = page.nextCursor === null;
      await checkpointStore.save(checkpoint);
      onProgress({ phase: 'discovery', discovered: checkpoint.assets.length });
    }
  }

  const processed = new Set(checkpoint.processedAssetIds);
  const pending = checkpoint.assets.filter(asset => !processed.has(asset.assetId));
  for (const batch of chunk(pending, batchSize)) {
    const retrievedAt = now().toISOString();
    let rows;
    try {
      rows = await provider.fetchAssetMetadata(batch);
    } catch (error) {
      checkpoint.errors.push({ scope: 'batch', assetIds: batch.map(asset => asset.assetId), message: error.message });
      await checkpointStore.save(checkpoint);
      break;
    }
    const rowsById = new Map(rows.filter(row => row?.policy_id && row?.asset_name).map(row => [`${row.policy_id}${row.asset_name}`, row]));
    for (const asset of batch) {
      try {
        const row = rowsById.get(asset.assetId);
        if (!row) throw new TypeError('Koios asset_info omitted the requested asset');
        const record = normalizeCip68Asset(koiosRowToEvidence(row, retrievedAt));
        checkpoint.records.push(record);
        checkpoint.processedAssetIds.push(asset.assetId);
        processed.add(asset.assetId);
      } catch (error) {
        checkpoint.errors.push({ scope: 'asset', assetId: asset.assetId, message: error.message });
      }
    }
    await checkpointStore.save(checkpoint);
    onProgress({ phase: 'metadata', processed: checkpoint.processedAssetIds.length, total: checkpoint.assets.length });
  }

  const uniqueIds = new Set(checkpoint.records.map(asset => asset.assetId));
  const checks = [
    {
      name: 'expected-count',
      status: checkpoint.records.length === expectedCount ? 'pass' : 'fail',
      message: `Expected ${expectedCount} canonical assets and produced ${checkpoint.records.length}.`,
    },
    {
      name: 'unique-assets',
      status: uniqueIds.size === checkpoint.records.length ? 'pass' : 'fail',
      message: `Produced ${uniqueIds.size} unique IDs from ${checkpoint.records.length} records.`,
    },
    {
      name: 'normalization-errors',
      status: checkpoint.errors.length ? 'fail' : 'pass',
      message: checkpoint.errors.length ? `${checkpoint.errors.length} import errors require review.` : 'No import errors.',
    },
  ];
  const snapshotId = `${startedAt}-${runId}`;
  const report = assertValidationReport({
    contractVersion: CONTRACT_VERSION,
    reportId: `validation-${runId}`,
    snapshotId,
    createdAt: now().toISOString(),
    status: checks.some(check => check.status === 'fail') ? 'invalid' : 'valid',
    checks,
  });
  const counts = terminalCounts();
  counts.discovered = checkpoint.assets.length;
  counts.fetched = checkpoint.processedAssetIds.length + checkpoint.errors.filter(error => error.scope === 'asset').length;
  counts.normalized = checkpoint.records.length;
  counts.changed = checkpoint.records.filter(asset => previousHashes.get(asset.assetId) !== asset.metadataHash).length;
  counts.errors = checkpoint.errors.length;
  const run = assertIngestionRun({
    contractVersion: CONTRACT_VERSION,
    runId,
    mode,
    provider: 'koios',
    startedAt,
    completedAt: now().toISOString(),
    status: report.status === 'valid' ? 'succeeded' : 'failed',
    counts,
  });
  return {
    run,
    report,
    snapshot: {
      contractVersion: CONTRACT_VERSION,
      snapshotId,
      publishedAt: run.completedAt,
      policyId: COLLECTION_POLICY_ID,
      expectedCount,
      assets: checkpoint.records,
    },
    errors: checkpoint.errors,
  };
}
