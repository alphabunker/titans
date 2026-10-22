# Full collection bootstrap validation — 2026-10-17

## Result

- Policy: `53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad`
- CIP-68 user tokens discovered: **6,500**
- Canonical assets normalized: **6,500**
- Import errors: **0**
- Snapshot: `2026-10-17T18:08:26.811Z-f3a91a75-d8e6-4e83-8488-491647c166b5`
- Analytics raw size: **2,567,510 bytes**
- Analytics gzip size: **359,532 bytes**
- Two-MiB compressed budget: **pass**

## Reconciliation

The ordered policy inventory contained 6,500 CIP-68 label-100 reference
tokens, 6,500 label-222 user tokens, and one policy token. The canonical
class index reconciled to all 6,500 assets:

| Class | Assets |
| --- | ---: |
| Royal | 220 |
| Mystic | 717 |
| Military | 1,518 |
| Townsfolk | 1,689 |
| Peasant | 2,336 |
| Titan | 20 |
| **Total** | **6,500** |

The five Pyramid classes total 6,480. The 20 Titans are indexed separately
and are not part of the Pyramid, matching the approved rule.

## Defects found and corrected

1. Koios offset pagination was nondeterministic without an explicit order,
   producing duplicate pages and an incomplete 4,562-asset candidate. Policy
   discovery now requests `order=asset_name.asc`.
2. Koios rejected 50- and 100-asset metadata bodies with HTTP 413. The live
   importer now uses batches of 25.

The successful rerun started from a fresh checkpoint after both corrections.

