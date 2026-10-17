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
snapshots/<snapshot-id>/validation-report.json
snapshots/<snapshot-id>/ingestion-run.json
snapshots/<snapshot-id>/manifest.json
exports/d1/<export-time>.sql          # operational backup story
```

Snapshot artifacts are immutable. Each manifest records artifact byte size and SHA-256 digest. `latest.json` is written last and only for a complete 6,500-asset snapshot with a valid report and successful run. A failed object write leaves the existing active pointer untouched.

## Activation sequence

1. Record/update the ingestion run in D1.
2. Upsert changed canonical assets and traits into D1.
3. Write immutable R2 collection, validation, and run artifacts.
4. Write and validate the manifest.
5. Save the current pointer to pointer history.
6. Replace `latest.json`.
7. Update D1 `active_snapshot` with the same snapshot ID, manifest key, hash, activation time, and run ID.

If step 7 fails, the public R2 pointer remains authoritative and the next reconciliation run repairs D1. Publication code must never update D1 active state before the R2 pointer succeeds.

## Recovery

- **Republish previous:** validate a retained pointer against its immutable manifest, archive the current pointer, and write the prior pointer to `latest.json`.
- **Restore D1:** import the most recent weekly or pre-migration export, then reconcile its active row to `latest.json`.
- **Rebuild:** run a full Cardano bootstrap, validate 6,500 canonical assets, write a new snapshot, and activate it normally.

D1 exports must be written weekly and immediately before migrations once production bindings exist. R2 lifecycle policy may remove older raw evidence only after the approved retention interval; active, previous, manifests, and required database exports must remain recoverable.

