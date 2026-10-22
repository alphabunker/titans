# Real-metadata collection explorer — 2026-10-17

Story: [#10 — Replace synthetic explorer data with the public real-metadata snapshot](https://github.com/alphabunker/titans/issues/10)

## Active snapshot

- Snapshot: `2026-10-17T18:47:40.350Z-24ef990e-1be2-48ce-8f9a-5a6b6d10700b`
- Status: complete
- Assets: 6,500 of 6,500
- Collection percentage: 100.00%
- Trait categories derived from canonical metadata: 12
- Class counts: 220 Royal, 717 Mystic, 1,518 Military, 1,689 Townsfolk,
  2,336 Peasant, and 20 Titan

The same-origin route was exercised against the R2-shaped local publication.
It returned HTTP 200 and the active snapshot ID, complete status, 6,500 assets,
and Edward North #1 with canonical Military class and IPFS identity.

The implementation was also deployed to the `titans-preview` Cloudflare Pages
project with the private `titans-snapshots-preview` R2 bucket bound as
`SNAPSHOTS`. The branch alias is
`https://feat-collection-explorer.titans-preview.pages.dev`. Both the page and
live `/api/collection` route returned HTTP 200. The live route returned the
same active snapshot, `complete` status, 6,500 assets, the snapshot ID as its
ETag, and the documented browser/edge cache policy.

## Version and failure safety

The public route reads one pointer and follows its exact manifest and canonical
artifact keys. It rejects mismatched pointer/manifest IDs, mismatched content
hashes, missing artifacts, invalid canonical contracts, and digest failures.
Failures return a non-cacheable 503. Unit coverage also verifies explicit
partial-state validation and rejects an incomplete payload labeled complete.

## Payload and interaction budgets

Measured by `npm run validate:public-snapshot`:

| Measure | Result | Budget |
| --- | ---: | ---: |
| Public JSON | 4,857,955 bytes | informational |
| Public JSON gzip | 899,508 bytes | 2,097,152 bytes |
| Full canonical-to-public projection | 39.814 ms | informational |
| Search/filter/sort p95, 100 runs | 0.746 ms | 100 ms |
| Mounted results per page | 48 | 48 |

These timings are local Node.js measurements, not browser service-level
guarantees. The fixed 48-result pages apply equally to desktop and mobile and
prevent a full-collection DOM/image fan-out.

## Verification

- JavaScript syntax checks passed.
- All 58 automated tests passed.
- Full 6,500-record contract, summary, filter-count, payload, and interaction
  validation passed.
- Local `/api/collection` and `/` both returned HTTP 200.
- Browser screenshot QA was unavailable because the automation runtime exposed
  no controllable browser surface.
