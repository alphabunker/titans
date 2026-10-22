import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { R2SnapshotStore } from '../src/storage/r2-snapshot-store.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const inputDirectory = resolve(argument('--input', '.data/full-bootstrap-ordered'));
const outputDirectory = resolve(argument('--output', '.data/publication'));
const previousPointerPath = argument('--previous-pointer', null);
const readJson = async name => JSON.parse(await readFile(join(inputDirectory, name), 'utf8'));
const [snapshot, analytics, report, run] = await Promise.all([
  readJson('collection.candidate.json'),
  readJson('analytics.json'),
  readJson('validation-report.json'),
  readJson('ingestion-run.json'),
]);

class DirectoryBucket {
  constructor(root, previousPointer = null) { this.root = root; this.previousPointer = previousPointer; }
  async put(key, bytes) {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  async get(key) {
    if (key !== 'latest.json' || !this.previousPointer) return null;
    const bytes = Buffer.from(`${JSON.stringify(this.previousPointer)}\n`);
    return { async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
  }
}

const previousPointer = previousPointerPath ? JSON.parse(await readFile(resolve(previousPointerPath), 'utf8')) : null;
const store = new R2SnapshotStore(new DirectoryBucket(join(outputDirectory, 'r2'), previousPointer));
const { pointer, manifest } = await store.publish({
  snapshot,
  analytics,
  report,
  run,
  normalizationVersion: snapshot.assets[0]?.normalizationVersion,
});

const quote = value => value === null || value === undefined
  ? 'NULL'
  : `'${String(value).replaceAll("'", "''")}'`;
const integer = value => value === null || value === undefined ? 'NULL' : String(value);
const groupsOf = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

const assetColumns = [
  'asset_id', 'policy_id', 'reference_asset_id', 'raw_asset_name_hex', 'raw_asset_name',
  'display_name', 'token_number', 'number_source', 'metadata_standard', 'cip68_label',
  'image_uri', 'image_cid', 'metadata_hash', 'normalization_version', 'source_provider',
  'source_retrieved_at', 'source_block_height', 'source_block_time', 'snapshot_id', 'updated_at',
];
const assetValues = asset => [
  quote(asset.assetId), quote(asset.policyId), quote(asset.referenceAssetId), quote(asset.rawAssetNameHex), quote(asset.rawAssetName),
  quote(asset.displayName), integer(asset.number), quote(asset.numberSource), quote(asset.metadataStandard), integer(asset.cip68Label),
  quote(asset.imageUri), quote(asset.imageCid), quote(asset.metadataHash), quote(asset.normalizationVersion), quote(asset.source.provider),
  quote(asset.source.retrievedAt), integer(asset.source.blockHeight), quote(asset.source.blockTime), quote(snapshot.snapshotId), quote(run.completedAt),
].join(', ');

const statements = [
  `INSERT INTO ingestion_runs (run_id, mode, provider, started_at, completed_at, status, discovered_count, fetched_count, normalized_count, changed_count, warning_count, error_count) VALUES (${[
    quote(run.runId), quote(run.mode), quote(run.provider), quote(run.startedAt), quote(run.completedAt), quote(run.status),
    integer(run.counts.discovered), integer(run.counts.fetched), integer(run.counts.normalized), integer(run.counts.changed), integer(run.counts.warnings), integer(run.counts.errors),
  ].join(', ')}) ON CONFLICT(run_id) DO UPDATE SET completed_at=excluded.completed_at, status=excluded.status, discovered_count=excluded.discovered_count, fetched_count=excluded.fetched_count, normalized_count=excluded.normalized_count, changed_count=excluded.changed_count, warning_count=excluded.warning_count, error_count=excluded.error_count;`,
];

// Keep each multi-row statement comfortably below D1's statement-size limit.
// A Titan currently has up to eleven canonical traits, so ten assets keeps
// both the asset and trait statements bounded while retaining bulk inserts.
for (const assets of groupsOf(snapshot.assets, 10)) {
  statements.push(`INSERT INTO assets (${assetColumns.join(', ')}) VALUES\n${assets.map(asset => `(${assetValues(asset)})`).join(',\n')}\nON CONFLICT(asset_id) DO UPDATE SET reference_asset_id=excluded.reference_asset_id, raw_asset_name_hex=excluded.raw_asset_name_hex, raw_asset_name=excluded.raw_asset_name, display_name=excluded.display_name, token_number=excluded.token_number, number_source=excluded.number_source, image_uri=excluded.image_uri, image_cid=excluded.image_cid, metadata_hash=excluded.metadata_hash, normalization_version=excluded.normalization_version, source_provider=excluded.source_provider, source_retrieved_at=excluded.source_retrieved_at, source_block_height=excluded.source_block_height, source_block_time=excluded.source_block_time, snapshot_id=excluded.snapshot_id, updated_at=excluded.updated_at;`);
  statements.push(`DELETE FROM asset_traits WHERE asset_id IN (${assets.map(asset => quote(asset.assetId)).join(', ')});`);
  const traits = assets.flatMap(asset => asset.traits.map((trait, ordinal) => [asset.assetId, ordinal, trait]));
  if (traits.length) {
    statements.push(`INSERT INTO asset_traits (asset_id, ordinal, category, value, normalized_category, normalized_value) VALUES\n${traits.map(([assetId, ordinal, trait]) => `(${quote(assetId)}, ${ordinal}, ${quote(trait.category)}, ${quote(trait.value)}, ${quote(trait.normalizedCategory)}, ${quote(trait.normalizedValue)})`).join(',\n')};`);
  }
  statements.push(`INSERT INTO metadata_sources (asset_id, metadata_hash, provider, retrieved_at, block_height, block_time, raw_object_key) VALUES\n${assets.map(asset => `(${quote(asset.assetId)}, ${quote(asset.metadataHash)}, ${quote(asset.source.provider)}, ${quote(asset.source.retrievedAt)}, ${integer(asset.source.blockHeight)}, ${quote(asset.source.blockTime)}, NULL)`).join(',\n')}\nON CONFLICT(asset_id, metadata_hash, provider) DO UPDATE SET retrieved_at=excluded.retrieved_at, block_height=excluded.block_height, block_time=excluded.block_time, raw_object_key=COALESCE(excluded.raw_object_key, metadata_sources.raw_object_key);`);
}

await mkdir(join(outputDirectory, 'd1'), { recursive: true });
await writeFile(join(outputDirectory, 'd1', 'canonical.sql'), `${statements.join('\n\n')}\n`, { mode: 0o600 });
await writeFile(join(outputDirectory, 'd1', 'activate.sql'), `INSERT INTO active_snapshot (singleton, snapshot_id, manifest_key, content_hash, activated_at, ingestion_run_id) VALUES (1, ${quote(pointer.snapshotId)}, ${quote(pointer.manifestKey)}, ${quote(pointer.contentHash)}, ${quote(pointer.activatedAt)}, ${quote(pointer.runId)}) ON CONFLICT(singleton) DO UPDATE SET snapshot_id=excluded.snapshot_id, manifest_key=excluded.manifest_key, content_hash=excluded.content_hash, activated_at=excluded.activated_at, ingestion_run_id=excluded.ingestion_run_id;\n`, { mode: 0o600 });

process.stdout.write(`${JSON.stringify({
  snapshotId: snapshot.snapshotId,
  assets: snapshot.assets.length,
  traits: snapshot.assets.reduce((total, asset) => total + asset.traits.length, 0),
  pointer,
  manifestArtifacts: manifest.artifacts,
  outputDirectory,
})}\n`);
