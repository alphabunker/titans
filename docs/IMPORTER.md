# Collection importer

The Node.js importer discovers CIP-68 user tokens under the verified policy, fetches them through Koios's bulk `asset_info` endpoint, decodes label 222 Plutus data, normalizes canonical records, and produces a candidate snapshot plus validation/run reports.

## Local command

Set server-side values from `.env.example` in your shell or ignored environment file, then run:

```sh
npm run import:collection -- --mode manual --output .data/import
```

The output directory and checkpoint are ignored by Git. Do not commit raw provider responses or secrets. Supported modes are `bootstrap`, `incremental`, and `manual`.

## Resume and safety behavior

- Policy discovery checkpoints after every page.
- Metadata processing checkpoints after every bounded batch.
- Already normalized asset IDs are skipped on restart.
- Duplicate discovery results are ignored by canonical asset ID.
- Koios 408/425/429/5xx responses use bounded exponential backoff and honor numeric `Retry-After` seconds.
- A missing asset, malformed CIP-68 datum, invalid canonical record, duplicate identity, normalization error, or unexpected collection count makes the candidate invalid.
- An invalid candidate exits non-zero and cannot be published by a later storage step.

The local checkpoint stores canonical collection records and therefore may be large. Story 01.4 will move durable run state, immutable artifacts, and publication pointers into D1/R2.

## GitHub Actions

`.github/workflows/metadata-import.yml` supports manual dispatch and runs daily at 07:17 UTC. It validates code first, executes one import with low concurrency, emits the GitHub step summary, and retains candidate/report artifacts for 14 days. It does not publish production data.

Configure `KOIOS_API_TOKEN` in the protected `preview` GitHub Environment. Production publication credentials are intentionally not used by this workflow yet.

## Provider evidence

The adapter follows the current official Koios OpenAPI source:

- `GET /policy_asset_list?_asset_policy=...` for policy discovery;
- `POST /asset_info` with `{ "_asset_list": [[policyId, assetNameHex], ...] }` for bulk details;
- `cip68_metadata` for label 222 datum metadata.

The deprecated `policy_asset_info` endpoint is not used.

