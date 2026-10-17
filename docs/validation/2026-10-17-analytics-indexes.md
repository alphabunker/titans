# Collection analytics indexes — 2026-10-17

Story: [#8 — Generate collection analytics indexes](https://github.com/alphabunker/titans/issues/8)

## Full-snapshot reconciliation

- Canonical assets: 6,500
- Distinct normalized trait values: 338
- Eligible cross-category pairings: 15,968
- Rules version: 1.1.0
- Published snapshot: `2026-10-17T18:47:40.350Z-24ef990e-1be2-48ce-8f9a-5a6b6d10700b`
- Previous snapshot retained: `2026-10-17T18:08:26.811Z-f3a91a75-d8e6-4e83-8488-491647c166b5`
- Class indexes: 220 Royal, 717 Mystic, 1,518 Military, 1,689 Townsfolk, 2,336 Peasant, and 20 Titan
- Titan remains a separate count and is not a Pyramid tier.
- The generator rebuilt and byte-compared all indexes from the canonical snapshot before writing the artifact.

Seven source categories contain the normalized placeholder value `none`.
Those frequencies remain available as canonical facts but are explicitly
flagged and excluded by default from collection-character and
unexpected-pairing features.

## Payload budget

- Raw JSON: 4,711,196 bytes
- Gzip: 471,139 bytes
- Budget: 2,097,152 bytes gzip
- Result: pass, using 22.5% of the budget

The payload includes the canonical asset-ID order and per-asset trait keys.
That allows every owner-specific computation to begin with only a list of
owned asset IDs and does not require another blockchain request.

## Owner lookup benchmark

Measured in Node.js over 500 iterations on the complete generated artifact:

| Owned Titans | p50 | p95 | Maximum |
| ---: | ---: | ---: | ---: |
| 1 | 4.131 ms | 4.898 ms | 6.068 ms |
| 20 | 4.414 ms | 4.978 ms | 5.386 ms |
| 100 | 5.497 ms | 6.018 ms | 6.770 ms |

These are local runtime measurements, not a browser service-level guarantee.
The benchmark script is reproducible with `npm run benchmark:analytics`.

## Curated mini-collections

The engine validates unique IDs, embeds each rule version, deterministically
evaluates trait conjunctions, and publishes matching canonical asset
positions. The nine editorial names and membership rules remain intentionally
unconfigured until their product approval in Story #17; no synthetic themes
were inserted into the real artifact.

## Preview publication

The canonical collection, rules-version 1.1.0 analytics, validation report,
ingestion run, and manifest were uploaded beneath the new immutable snapshot
prefix in private R2. Every object was downloaded and byte-compared before
`latest.json` changed. D1 and R2 now identify the same active snapshot and
content hash, while the prior pointer is retained under `pointers/history/`.
