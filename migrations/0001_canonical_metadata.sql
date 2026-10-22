PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('bootstrap', 'incremental', 'manual')),
  provider TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  fetched_count INTEGER NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
  normalized_count INTEGER NOT NULL DEFAULT 0 CHECK (normalized_count >= 0),
  changed_count INTEGER NOT NULL DEFAULT 0 CHECK (changed_count >= 0),
  warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0)
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  reference_asset_id TEXT,
  raw_asset_name_hex TEXT NOT NULL,
  raw_asset_name TEXT,
  display_name TEXT,
  token_number INTEGER,
  number_source TEXT CHECK (number_source IN ('metadata', 'asset-name') OR number_source IS NULL),
  metadata_standard TEXT NOT NULL CHECK (metadata_standard = 'CIP-68'),
  cip68_label INTEGER NOT NULL,
  image_uri TEXT,
  image_cid TEXT,
  metadata_hash TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  source_block_height INTEGER,
  source_block_time TEXT,
  snapshot_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_policy_number_idx ON assets(policy_id, token_number);
CREATE INDEX IF NOT EXISTS assets_snapshot_idx ON assets(snapshot_id);
CREATE INDEX IF NOT EXISTS assets_metadata_hash_idx ON assets(metadata_hash);

CREATE TABLE IF NOT EXISTS asset_traits (
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_category TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  PRIMARY KEY (asset_id, ordinal)
);

CREATE INDEX IF NOT EXISTS asset_traits_lookup_idx ON asset_traits(normalized_category, normalized_value, asset_id);

CREATE TABLE IF NOT EXISTS metadata_sources (
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  metadata_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  block_height INTEGER,
  block_time TEXT,
  raw_object_key TEXT,
  PRIMARY KEY (asset_id, metadata_hash, provider)
);

CREATE TABLE IF NOT EXISTS active_snapshot (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  snapshot_id TEXT NOT NULL,
  manifest_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  ingestion_run_id TEXT NOT NULL REFERENCES ingestion_runs(run_id)
);

