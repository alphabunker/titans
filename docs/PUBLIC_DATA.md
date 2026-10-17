# Public collection data

The explorer reads `GET /api/collection` from its own origin. The Cloudflare
Pages Function reads `latest.json` once, verifies the referenced manifest,
loads the exact canonical artifact named by that manifest, verifies its SHA-256
digest and snapshot ID, and only then projects the browser contract. It never
combines a pointer, manifest, analytics file, or collection from different
snapshot versions.

The response keeps the canonical asset ID, display and raw names, Titan number,
CIP-68 standard and metadata hash, original IPFS URI/CID, all source trait
values, and compact provider timestamps. Provider payloads, D1/R2 credentials,
and blockchain-provider credentials are not public fields.

`GET /api/analytics` follows the same active pointer, verifies the matching
manifest and analytics artifact digest, validates its snapshot ID and asset
count, and serves the precomputed Fortress indexes. The browser rejects
analytics that do not identify the same snapshot as `/api/collection`.

## Cache behavior

- Browser freshness: 60 seconds.
- Shared-edge freshness: 5 minutes.
- Stale-while-revalidate allowance: 24 hours.
- ETag: the immutable snapshot ID.
- Failed validation returns `503` with `no-store`; the route never emits the
  rejected candidate as collection data.

Each successful response is self-contained and identifies one immutable
snapshot. A cache may therefore serve either the prior complete version or the
new complete version during a pointer change, but never a mixture of both.

## Browser states

The browser validates the public contract before rendering any record. It shows
distinct loading, current, stale (activation older than 48 hours), explicitly
partial, and unavailable states. A rejected response does not fall back to
synthetic items. Partial data can only render when its response is explicitly
marked `partial` and its count matches the included records; the production
route only generates `complete` responses from a 6,500-asset canonical
snapshot.

## Interaction and performance budgets

- Complete public payload: at most 2 MiB gzip.
- Search, filter, sort, saved-item, table, grid, and detail interactions operate
  only on the loaded in-memory snapshot and make no blockchain-provider calls.
- Owner summary, collection-character ranking, Unexpected Pairings ranking,
  five-rank Pyramid progress, Rare Details rarity bands, nine mini-collection
  memberships, and their
  complete/owned matching-Titan views operate on the loaded analytics and
  owned asset IDs without provider calls.
- At most 48 result rows/cards are mounted per page on desktop and mobile.
- Images begin loading near the viewport; paging replaces the prior result DOM
  rather than accumulating all 6,500 images.
- Target filtering/sorting p95: under 100 ms in the reproducible Node benchmark.

Validate the complete active artifact with:

```sh
npm run validate:public-snapshot
```
