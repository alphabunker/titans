import { assertCanonicalAsset, assertIngestionRun } from '../contracts.js';

export class D1CanonicalRepository {
  constructor(database) {
    if (!database?.prepare || !database?.batch) throw new TypeError('A Cloudflare D1 binding is required');
    this.database = database;
  }

  async recordRun(run) {
    assertIngestionRun(run);
    const statement = this.database.prepare(`
      INSERT INTO ingestion_runs (
        run_id, mode, provider, started_at, completed_at, status,
        discovered_count, fetched_count, normalized_count, changed_count, warning_count, error_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        completed_at = excluded.completed_at,
        status = excluded.status,
        discovered_count = excluded.discovered_count,
        fetched_count = excluded.fetched_count,
        normalized_count = excluded.normalized_count,
        changed_count = excluded.changed_count,
        warning_count = excluded.warning_count,
        error_count = excluded.error_count
    `).bind(
      run.runId, run.mode, run.provider, run.startedAt, run.completedAt, run.status,
      run.counts.discovered, run.counts.fetched, run.counts.normalized,
      run.counts.changed, run.counts.warnings, run.counts.errors,
    );
    return statement.run();
  }

  async upsertAsset(asset, snapshotId, updatedAt = new Date().toISOString()) {
    assertCanonicalAsset(asset);
    if (!snapshotId) throw new TypeError('snapshotId is required');
    const statements = [
      this.database.prepare(`
        INSERT INTO assets (
          asset_id, policy_id, reference_asset_id, raw_asset_name_hex, raw_asset_name,
          display_name, token_number, number_source, metadata_standard, cip68_label,
          image_uri, image_cid, metadata_hash, normalization_version, source_provider,
          source_retrieved_at, source_block_height, source_block_time, snapshot_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          reference_asset_id = excluded.reference_asset_id,
          raw_asset_name_hex = excluded.raw_asset_name_hex,
          raw_asset_name = excluded.raw_asset_name,
          display_name = excluded.display_name,
          token_number = excluded.token_number,
          number_source = excluded.number_source,
          image_uri = excluded.image_uri,
          image_cid = excluded.image_cid,
          metadata_hash = excluded.metadata_hash,
          normalization_version = excluded.normalization_version,
          source_provider = excluded.source_provider,
          source_retrieved_at = excluded.source_retrieved_at,
          source_block_height = excluded.source_block_height,
          source_block_time = excluded.source_block_time,
          snapshot_id = excluded.snapshot_id,
          updated_at = excluded.updated_at
      `).bind(
        asset.assetId, asset.policyId, asset.referenceAssetId, asset.rawAssetNameHex, asset.rawAssetName,
        asset.displayName, asset.number, asset.numberSource, asset.metadataStandard, asset.cip68Label,
        asset.imageUri, asset.imageCid, asset.metadataHash, asset.normalizationVersion, asset.source.provider,
        asset.source.retrievedAt, asset.source.blockHeight, asset.source.blockTime, snapshotId, updatedAt,
      ),
      this.database.prepare('DELETE FROM asset_traits WHERE asset_id = ?').bind(asset.assetId),
      ...asset.traits.map((trait, ordinal) => this.database.prepare(`
        INSERT INTO asset_traits (
          asset_id, ordinal, category, value, normalized_category, normalized_value
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(asset.assetId, ordinal, trait.category, trait.value, trait.normalizedCategory, trait.normalizedValue)),
      this.database.prepare(`
        INSERT INTO metadata_sources (
          asset_id, metadata_hash, provider, retrieved_at, block_height, block_time, raw_object_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id, metadata_hash, provider) DO UPDATE SET
          retrieved_at = excluded.retrieved_at,
          block_height = excluded.block_height,
          block_time = excluded.block_time,
          raw_object_key = COALESCE(excluded.raw_object_key, metadata_sources.raw_object_key)
      `).bind(
        asset.assetId, asset.metadataHash, asset.source.provider, asset.source.retrievedAt,
        asset.source.blockHeight, asset.source.blockTime, null,
      ),
    ];
    return this.database.batch(statements);
  }

  async metadataHashes() {
    const result = await this.database.prepare('SELECT asset_id, metadata_hash FROM assets').all();
    return new Map((result.results ?? []).map(row => [row.asset_id, row.metadata_hash]));
  }

  async activateSnapshot({ snapshotId, manifestKey, contentHash, activatedAt, runId }) {
    if (![snapshotId, manifestKey, contentHash, activatedAt, runId].every(Boolean)) throw new TypeError('Complete active snapshot details are required');
    return this.database.prepare(`
      INSERT INTO active_snapshot (singleton, snapshot_id, manifest_key, content_hash, activated_at, ingestion_run_id)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        snapshot_id = excluded.snapshot_id,
        manifest_key = excluded.manifest_key,
        content_hash = excluded.content_hash,
        activated_at = excluded.activated_at,
        ingestion_run_id = excluded.ingestion_run_id
    `).bind(snapshotId, manifestKey, contentHash, activatedAt, runId).run();
  }
}

