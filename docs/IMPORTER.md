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
- Metadata hashes produce an explicit `changedAssets` set so persistence can
  skip unchanged canonical rows during incremental runs.
- Duplicate discovery results are ignored by canonical asset ID.
- Koios 408/425/429/5xx responses use bounded exponential backoff and honor numeric `Retry-After` seconds.
- A missing asset, malformed CIP-68 datum, invalid canonical record, duplicate identity, normalization error, or unexpected collection count makes the candidate invalid. Item failures record the provider, asset ID, raw asset-name hex, and error without exposing credentials.
- An invalid candidate exits non-zero and cannot be published by a later storage step.

The local checkpoint stores canonical collection records and therefore may be large. Story 01.4 will move durable run state, immutable artifacts, and publication pointers into D1/R2.

## GitHub Actions

`.github/workflows/metadata-import.yml` supports manual preview/production
dispatch and runs daily at 07:17 UTC through the protected production
environment. It validates code first, executes one import with low concurrency,
emits the GitHub step summary, retains candidate/report artifacts for 14 days,
exports D1, uploads immutable R2 objects, activates `latest.json` last, and then
reconciles the D1 active pointer.

Configure separate Koios and Cloudflare credentials plus resource variables in
the `preview` and `production` GitHub Environments. Production is restricted to
`main`; add an environment reviewer when supported by the repository plan. See
`docs/OPERATIONS.md`.

## Provider evidence

The adapter follows the current official Koios OpenAPI source:

- `GET /policy_asset_list?_asset_policy=...` for policy discovery;
- `POST /asset_info` with `{ "_asset_list": [[policyId, assetNameHex], ...] }` for bulk details;
- `cip68_metadata` for label 222 datum metadata.

The deprecated `policy_asset_info` endpoint is not used.

Policy discovery is explicitly ordered by asset name before offset pagination;
the live policy contains 6,500 reference tokens and 6,500 user tokens, so
unordered pages can otherwise shift and silently omit user tokens. Metadata
batches contain at most 25 assets to stay below Koios's public request-body
limit.

## Blockfrost verification and failover

`BlockfrostProvider` implements the same importer boundary using the official
`GET /assets/policy/{policy_id}` and `GET /assets/{asset}` endpoints. It uses
stable ascending pages, bounded request concurrency, the same retry policy,
and validates Blockfrost's decoded `CIP68v*` metadata before normalization.

Blockfrost requires a server-side `project_id`; set `BLOCKFROST_PROJECT_ID`
only in protected runtime or CI secrets. Because its asset-detail API is one
request per asset, Koios remains the efficient bootstrap source. Blockfrost is
the independent verification/failover path and must not be called directly
from the browser.
