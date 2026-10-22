# Preview D1 and R2 publication — 2026-10-17

Story: [#7 — Persist canonical data and publish atomic snapshots](https://github.com/alphabunker/titans/issues/7)

## Resources

- D1 database: `titans-metadata-preview` (WNAM)
- R2 bucket: `titans-snapshots-preview` (private, Standard storage)
- Snapshot: `2026-10-17T18:08:26.811Z-f3a91a75-d8e6-4e83-8488-491647c166b5`
- Ingestion run: `f3a91a75-d8e6-4e83-8488-491647c166b5`
- Canonical hash: `sha256:f7b8e4490b2d63ec081885acfa301bd3068c8cc72cd568f445274831c20416bf`

## Verified publication

1. Applied `migrations/0001_canonical_metadata.sql` to preview D1.
2. Imported idempotent canonical SQL while leaving `active_snapshot` empty.
3. Verified 6,500 assets, 71,320 asset traits, 6,500 source records, one successful ingestion run, and zero active rows before promotion.
4. Uploaded the canonical collection, analytics, validation report, ingestion run, and manifest beneath the immutable snapshot prefix.
5. Downloaded every object and matched its SHA-256 digest to the local publication package.
6. Uploaded `latest.json` only after those checks passed.
7. Activated the identical snapshot in D1 and verified snapshot ID, manifest key, content hash, activation time, and run ID against the R2 pointer.
8. Re-ran all 2,601 canonical import statements. Counts remained 6,500 assets,
   71,320 traits, 6,500 source records, one ingestion run, and one unchanged
   active snapshot, proving the preview import is idempotent.

The collection object is 12,812,053 bytes. Its downloaded digest was
`f7b8e4490b2d63ec081885acfa301bd3068c8cc72cd568f445274831c20416bf`.

## Recovery evidence

- Exported the active D1 database to `exports/d1/titans-metadata-preview-2026-10-17.sql` in private R2.
- Export size: 27,892,743 bytes.
- Export SHA-256: `8e2d876da9915d27db6fd517c1e91fa04b9e706df04ebca5ba591f11b9b52cc2`.
- Downloaded the R2 export and byte-compared it with the local export.
- Archived a retained pointer, restored it to `latest.json`, downloaded and byte-verified it, then restored and re-verified the current pointer.
- The automated storage test covers rollback between different snapshot IDs and rejects a rollback when the retained pointer does not match its immutable manifest.

This was the first real publication, so no older real snapshot ID existed.
The live drill therefore exercised the exact pointer recovery path against an
earlier retained activation of the same immutable snapshot. The next publish
will retain this snapshot as the genuine prior version without requiring a
blockchain re-import.

## Final active state

R2 `latest.json` and D1 `active_snapshot` both identify the snapshot, manifest,
canonical hash, activation time, and ingestion run listed above. The R2 bucket
remains private; public API and UI delivery are intentionally out of scope for
this story.
