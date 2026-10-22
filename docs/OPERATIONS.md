# Operations and launch runbook

## Release controls

`Required checks` runs syntax checks, all unit/schema/normalization/analytics and
accessibility-critical interaction tests, the production build, and a secret
scan over Git history plus generated artifacts. Configure the `main` branch to
require pull requests and its `verify` job before merge.

`Deploy site` repeats those gates and deploys immutable build output:

- pull requests use the GitHub `preview` environment and a stable `pr-<number>`
  Cloudflare Pages branch;
- `main` uses the GitHub `production` environment and the Pages production
  branch;
- manual dispatch can target either environment;
- production must require an environment reviewer and restrict deployment to
  `main`.

Each GitHub environment supplies its own `CLOUDFLARE_API_TOKEN` secret plus
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`,
`CLOUDFLARE_D1_DATABASE`, and `CLOUDFLARE_R2_BUCKET` variables. Tokens should
be least privilege and must never be copied into workflow text or artifacts.

The repository has `preview` and `production` GitHub environments. Preview
contains only the non-production resource variables and its least-privilege
deployment token. Production accepts
deployments from `main` only; production resource variables and credentials
remain intentionally unset until those separate resources are approved and
provisioned. Required reviewers should be added if the repository plan exposes
that protection rule.

## Metadata publication

`Metadata import` is separate from code deployment. It runs daily at 07:17 UTC
and can be dispatched manually for preview or production. Production execution
waits on the protected `production` environment.

The workflow runs required checks, imports a complete candidate, generates
analytics, exports D1, applies canonical rows, uploads immutable R2 artifacts,
writes `latest.json` last, and then reconciles the D1 active pointer. An invalid
or partial import exits before storage mutation. A failure before activation
leaves prior R2 data active. A D1 activation failure leaves R2 authoritative
and is repaired by rerunning the generated activation SQL. Candidate and report
artifacts are retained for 14 days.

## Health and observability

`GET /api/health` validates the active pointer, manifest, canonical artifact
identity, analytics contract, rules version, and asset count. It returns
`200 healthy` when the snapshot is at most 48 hours old, `503 degraded` when
older, and `503 unhealthy` when the data chain cannot be verified. Responses
contain no credentials, addresses, provider payloads, or exception text.

Failed checks are written to Workers Logs with a redacted diagnostic. Portfolio
timeouts/outages keep distinct public codes and server log events; image
failures remain visible as bounded card fallbacks without breaking browsing.

`Platform health monitor` runs twice hourly against `MONITORED_SITE_URL`, checks
health plus both public data routes, and opens or updates one GitHub operator
issue on failure. GitHub's failed-workflow notifications remain the ingestion
and deployment alert channel.

Cloudflare Web Analytics is enabled and active on the preview Pages project
with no browser credential. Confirm page
views and Core Web Vitals in the Cloudflare dashboard after each launch.
Cloudflare Workers Observability is available on the account free tier; the
application logs only redacted server-side failures and never submitted wallet
addresses. Production must enable the same controls when provisioned.

## Incident response

1. Confirm scope with `/api/health`, the stable URL, Workers Logs, the latest
   metadata workflow, and the active R2 pointer.
2. Freeze metadata publication by disabling it or withholding environment
   approval; do not delete current objects.
3. Roll Pages back for a code-only incident, or republish the prior verified R2
   pointer for a data incident and reconcile D1 afterward.
4. Rotate affected credentials before resuming service.
5. Verify the collection/analytics identity, 6,500 assets, Fortress behavior,
   and `/api/health` before closure.
6. Record timeline, cause, versions, recovery evidence, and follow-up work in a
   GitHub issue without pasting wallet addresses, secrets, or provider payloads.

## Recovery procedures

### Republish the previous snapshot

Download a retained pointer from `pointers/history/`, verify its manifest and
canonical digest, archive the current pointer, then upload the verified prior
pointer as `latest.json`. Check `/api/collection`, `/api/analytics`, and
`/api/health`, then reconcile D1. Never edit immutable snapshot objects.

### Restore D1

Export D1 before every publication and migration. Restore a verified export:

```sh
npx wrangler d1 execute <database> --remote --file <verified-export.sql>
```

Compare `assets`, `asset_traits`, `ingestion_runs`, and `active_snapshot` with
the matching manifest and R2 pointer. D1 is rebuildable; public serving remains
anchored to R2.

### Rebuild from Cardano

Run a clean bootstrap with an empty checkpoint, validate exactly 6,500 CIP-68
user tokens, regenerate analytics, compare class/trait totals, and publish
through the protected metadata workflow. Never activate a candidate with
errors, duplicates, missing assets, policy drift, or a failed report.

### Roll back the frontend

Select the last successful Pages deployment whose source commit passed checks,
promote it in Cloudflare Pages, and verify the page, security headers,
`/api/health`, and both public data routes. Frontend rollback does not change
the metadata pointer.

## Credential rotation

1. Issue a least-privilege replacement token.
2. Replace the GitHub Environment or Cloudflare secret without logging it.
3. Dispatch a preview health/import/deploy check.
4. Repeat for production after approval.
5. Revoke the old token and record owner, date, scope, and next review without
   recording its value.

Suspected exposure requires immediate rotation. Run `npm run scan:secrets` and
inspect GitHub secret-scanning results before treating it as contained.

## Service limits, costs, and replacement

| Service | Review/alert point | Upgrade rule | Replacement boundary |
| --- | --- | --- | --- |
| Koios | 40,000 requests/day or repeated outages | Explicit approval | `MetadataProvider`; Blockfrost failover |
| Workers/Pages Functions | 75,000 requests/day | Approval before paid Workers | Same-origin serverless routes |
| D1 | 75,000 writes/day, 4M reads/day, or 4 GB | Explicit approval | `D1CanonicalRepository` adapter |
| R2 | 8 GB or 8M reads/month | Explicit approval | `R2SnapshotStore` adapter |
| Pinata | 80% of any allowance | Approval for Picnic or higher | Configurable IPFS gateway; CID unchanged |
| GitHub Actions | 70% of included minutes | Explicit approval | Any runner executing the same scripts |
| Browser payload | 2 MiB compressed | Architecture review | Shards or narrow read API |

Enable provider alerts at these points. No paid plan, domain, or quota increase
is authorized by this runbook alone.

## Launch boundary

Launch is read-only. It does not require ownership gating, CIP-8, accounts,
marketplace data, prices, transactions, transfers, delegation, or signatures.
Those capabilities require separate product and security review.
