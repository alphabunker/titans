# Collection analytics

`buildCollectionAnalytics` deterministically derives the compact collection-wide indexes used by The Fortress. It operates on a single canonical snapshot and emits the same `snapshotId` plus a versioned rules identifier.

## Precomputed values

- global count, percentage, and rarity band for every normalized category/value pair;
- global support count for every eligible cross-category trait pair;
- asset-position indexes for individual traits and classes;
- a canonical asset-ID order and per-asset trait-key index so owner analytics
  need only the owned asset IDs returned by the holdings boundary;
- the approved five-tier Pyramid class indexes and a separate Titan index;
- membership indexes for approved, versioned mini-collection rules.

Pair indexes intentionally store global counts rather than repeating asset IDs for every pair. When a visitor opens one pairing, the browser can scan the 6,500 canonical assets for that pair. This reduces the published payload while still avoiding a blockchain or provider request.

## Exclusions and identity

- Pairing generation excludes same-category pairs.
- Placeholder-normalized values such as `None` and `NONE` are excluded from pairings, while their original source values remain in global trait frequencies.
- Every placeholder-like frequency is explicitly marked with
  `placeholderLike` and its feature-specific default exclusions. This keeps
  the underlying fact queryable without presenting it as collection
  character or an unexpected pairing.
- An asset contributes at most once to a normalized trait or pair count.
- Index arrays contain zero-based positions in the matching canonical snapshot, not duplicated asset IDs.

## Payload budget

Generate and measure a candidate analytics file with:

```sh
npm run analytics -- --input .data/import/collection.candidate.json --output .data/import/analytics.json
```

The command reports raw and gzip byte counts and exits with status 2 if the compressed file exceeds 2 MiB. Crossing that threshold requires a documented sharding or narrow-read-API decision before publication.

Benchmark the serialized artifact and owner-only lookups with:

```sh
npm run benchmark:analytics -- \
  --snapshot .data/full-bootstrap-ordered/collection.candidate.json \
  --analytics .data/analytics-story8/analytics.json \
  --iterations 500
```

The full 6,500-asset rules-version 1.1.0 artifact measured 4,711,196 bytes
raw and 471,139 bytes gzip on 2026-10-17, well below the 2 MiB target. R2
publication validates that analytics reference the same snapshot and asset
count, then writes `analytics.json` before the atomic `latest.json` pointer
changes.

## Rule versions

`src/fortress-rules.js` owns the initial Pyramid and rarity boundaries. Mini-collection rules are supplied as approved configuration and embedded with their own version. A change to calculation semantics increments `FORTRESS_RULES_VERSION` and regenerates the analytics artifact. Rules version 1.1.0 adds explicit placeholder flags and the owner-only lookup indexes; it does not change the approved Pyramid or rarity thresholds.
