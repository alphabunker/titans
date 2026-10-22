# Launch readiness and recovery validation — 2026-10-17

Story: [#18 — Harden, observe, recover, and launch the real-metadata platform](https://github.com/alphabunker/titans/issues/18)

## Release gates and active health

- `npm run check`: pass.
- `npm test`: **85 of 85 pass**.
- `npm run build`: pass; `_headers` and Pages Functions included.
- `npm run scan:secrets`: pass across **382 unique Git blobs** plus the
  generated site and available publication artifacts.
- All four GitHub workflow files parsed successfully as YAML.
- Local full-snapshot smoke test: `/api/health` returned `200 healthy`,
  snapshot `2026-10-17T18:47:40.350Z-24ef990e-1be2-48ce-8f9a-5a6b6d10700b`,
  6,500 assets, rules `1.2.0`, and matching collection identity.
- The Cloudflare recovery deployment returned the same healthy result and the
  root response included CSP, HSTS, Permissions Policy, Referrer Policy,
  nosniff, frame denial, and preview no-index headers.

GitHub `preview` and `production` environments were created. Preview contains
the non-production account, Pages, D1, and R2 variables. Production is limited
to the `main` branch and intentionally contains no production resource values
until separate production resources are approved. Cloudflare Web Analytics is
enabled and active; the deployed page includes its beacon. Workers metrics and the
account-level Workers Observability event console are available on the free
plan.

The GitHub `preview` environment holds a least-privilege Cloudflare token with
Pages, D1, and R2 write access plus account read access. The pull-request deploy
workflow completed its verification and Pages deployment jobs successfully.
The `main` branch rule requires pull requests and the `verify` status check,
and GitHub enforces the rule for the public repository.

## Full-dataset performance

The rules `1.2.0` analytics artifact contains all 6,500 assets and is
**4,717,869 bytes raw / 474,203 bytes gzip**, passing the 2 MiB budget. Over
500 local iterations:

| Owned Titans | p50 | p95 | Maximum |
| ---: | ---: | ---: | ---: |
| 1 | 5.443 ms | 6.891 ms | 21.679 ms |
| 20 | 7.191 ms | 7.906 ms | 8.713 ms |
| 100 | 10.677 ms | 12.340 ms | 19.118 ms |

These are reproducible Node.js measurements, not a network service-level
guarantee. Explorer projection, filtering, pagination, and payload evidence is
recorded in `2026-10-17-public-explorer.md`.

## Browser, mobile, and keyboard QA

Chrome loaded the stable preview with the complete dataset and a 204-Titan
read-only portfolio. The page exposed the collection character, Unexpected
Pairings, five-rank Pyramid, Rare Details, and all nine mini-collections with
semantic headings and controls. The owner summary reported 204 Titans, 3.14%
of the collection, and four represented classes.

The collection explorer reported 6,500 of 6,500 Titans and all 12
metadata-derived filter categories. Searching for `Edward` reduced the result
set to 11 and switching to table view exposed the complete trait columns; the
search and view were then reset to the default 48-card first page.

At a responsive **400 × 786 CSS-pixel** viewport, the Fortress entry cards,
text, wallet controls, NFT imagery, pairing cards, and full-width action
buttons remained readable without horizontal overflow. The layout collapsed
to a single content column as designed. Desktop QA used the same Chrome build
at its normal window width.

Keyboard activation of **Meet the pairing** opened a labelled dialog, exposed
the collection and owned tabs, and listed the matching Titans. Escape closed
the dialog and returned focus to the originating button. NFT images expose
meaningful alt text and on-chain IPFS provenance. Media failures remain visible
as bounded `Titan image unavailable` fallbacks rather than breaking the page.

## Recovery drills

### 1. Snapshot rollback

The storage test published immutable artifacts before `latest.json`, retained
the previous pointer, verified its manifest, rolled back the active pointer,
and rejected an invalid retained pointer. Publication-failure coverage also
proved that partial object writes cannot replace active data.

### 2. D1 restore

The remote preview D1 database was exported, then restored into a new isolated
local D1 instance. Post-restore reconciliation returned:

- 6,500 assets;
- 71,320 asset traits;
- two ingestion runs;
- active snapshot
  `2026-10-17T18:47:40.350Z-24ef990e-1be2-48ce-8f9a-5a6b6d10700b`.

No live D1 rows or active pointer were changed by this drill.

### 3. Rebuild from Cardano

The clean Koios bootstrap discovered and normalized exactly 6,500 CIP-68 user
tokens with zero errors. Class totals reconciled to 6,500, including the 20
Titan-class NFTs that remain outside the Pyramid. Full evidence is in
`2026-10-17-full-bootstrap.md`.

### Frontend rollback

Commit `8a40b91` was built from a clean archive and deployed to the isolated
Cloudflare Pages branch `recovery-drill`. Its public collection route returned
HTTP 200. The current verified build was then redeployed to the same branch;
`/api/health` returned `200 healthy` with 6,500 assets and rules `1.2.0`.
The stable feature preview was not changed during the drill.

## Operating boundary

The runbook in `docs/OPERATIONS.md` records incident response, credential
rotation, all recovery procedures, service limits, alert points, upgrade
approval, and vendor replacement boundaries. No paid plan or production
resource was created. Launch remains read-only and does not require gating,
CIP-8, accounts, marketplace data, transactions, transfers, or delegation.
