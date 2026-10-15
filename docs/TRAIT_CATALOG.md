# Verified trait catalog

Canonical machine-readable values live in `src/trait-catalog.js`. This document records how to interpret them.

| Field | Status |
| --- | --- |
| Back, Background, Class, Eyes, Face, Hand, Head, House, Outfit, Skin, Special, Type | Source-observed category and values; available as filters |
| Trait Count | Source-observed values only; not assigned to fixtures or calculated |
| Individual NFT combinations | Unknown; synthetic in this preview |
| Counts shown beside source options | Not retained; they were a point-in-time source observation |

The snapshot contains 13 categories. Do not normalize capitalization or collapse `None` and `NONE`. Do not infer a real NFT's metadata from the synthetic fixtures. When live metadata is integrated, compare it against this snapshot, document differences, and establish the definition of Trait Count before enabling that filter.
