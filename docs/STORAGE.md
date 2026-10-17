# Canonical storage and snapshot publication

## D1

`migrations/0001_canonical_metadata.sql` creates:

- `assets` for the current rebuildable canonical materialized view;
- `asset_traits` for indexed category/value filtering;
- `metadata_sources` for hash/provider/retrieval lineage;
- `ingestion_runs` for durable operational outcomes;
- `active_snapshot` for the database-side active publication record.

`D1CanonicalRepository` uses bound parameters and D1 batches. Re-importing an asset updates its canonical row, replaces its ordered traits, and upserts source lineage. The database contains no wallet addresses, holdings, secrets, or arbitrary provider payloads.

## R2 layout

```text
latest.json
pointers/history/<activation-time>-<snapshot-id>.json
snapshots/<snapshot-id>/collection.json
snapshots/<snapshot-id>/analytics.json
snapshots/<snapshot-id>/validation-report.json
snapshots/<snapshot-id>/ingestion-run.json
snapshots/<snapshot-id>/manifest.json
exports/d1/<export-time>.sql          # operational backup story
```

Snapshot artifacts are immutable. Each manifest records artifact byte size and SHA-256 digest. `latest.json` is written last and only for a complete 6,500-asset snapshot with a valid report and successful run. A failed object write leaves the existing active pointer untouched.

## Activation sequence

1. Record/update the ingestion run in D1.
2. Upsert changed canonical assets and traits into D1.
3. Write immutable R2 collection, analytics, validation, and run artifacts.
4. Write and validate the manifest.
5. Save the current pointer to pointer history.
6. Replace `latest.json`.
7. Update D1 `active_snapshot` with the same snapshot ID, manifest key, hash, activation time, and run ID.

If step 7 fails, the public R2 pointer remains authoritative and the next reconciliation run repairs D1. Publication code must never update D1 active state before the R2 pointer succeeds.

Prepare validated, resumable publication artifacts with:

```sh
npm run prepare:publication -- \
  --input .data/full-bootstrap-ordered \
  --output .data/publication
```

The ignored output contains idempotent `d1/canonical.sql`, a separate
`d1/activate.sql`, and an R2 object tree. Apply canonical rows first, upload
immutable R2 artifacts, upload `latest.json` last, and only then apply the D1
activation file. Separating activation prevents a partial upload from
becoming active in either store.

## Recovery

- **Republish previous:** validate a retained pointer against its immutable manifest, archive the current pointer, and write the prior pointer to `latest.json`.
- **Restore D1:** import the most recent weekly or pre-migration export, then reconcile its active row to `latest.json`.
- **Rebuild:** run a full Cardano bootstrap, validate 6,500 canonical assets, write a new snapshot, and activate it normally.

D1 exports must be written weekly and immediately before migrations once production bindings exist. R2 lifecycle policy may remove older raw evidence only after the approved retention interval; active, previous, manifests, and required database exports must remain recoverable.

Use Wrangler's supported export/import path for those retained copies:

```sh
npx wrangler d1 export titans-metadata --remote --output exports/d1/<timestamp>.sql -y
npx wrangler d1 execute titans-metadata --remote --file exports/d1/<timestamp>.sql
```

Before applying a migration, take the export first, then run
`npx wrangler d1 migrations apply titans-metadata --remote`. For local
verification, use the same migration command with `--local`. Cloudflare D1
Time Travel is an additional recovery layer, not a replacement for the
retained pre-migration export and the immutable R2 snapshot.

### Preview resources

The repository's `wrangler.jsonc` binds the preview publisher to:

- D1 database `titans-metadata-preview` as `DB`;
- private R2 bucket `titans-snapshots-preview` as `SNAPSHOTS`.

Keep the bucket private. Public data delivery belongs to the API/worker story,
not to the storage layer. The first publication has no older snapshot to roll
back to. Starting with the second publication, pass the downloaded current
pointer to `prepare:publication` with `--previous-pointer`; the preparer will
retain it under `pointers/history/` and set `previousSnapshotId` in the new
pointer.
