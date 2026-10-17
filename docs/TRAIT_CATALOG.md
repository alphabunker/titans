# Verified trait catalog

Canonical machine-readable values live in `src/trait-catalog.js`. This document records how to interpret them.

| Field | Status |
| --- | --- |
| Back, Background, Class, Eyes, Face, Hand, Head, House, Outfit, Skin, Special, Type | Present in canonical CIP-68 metadata; filter values and counts derive from the active snapshot |
| Trait Count | Historical source-observed values only; absent from canonical metadata and not filterable |
| Individual NFT combinations | Canonical per-asset values from the active snapshot |
| Filter counts | Calculated from all records in the validated active snapshot |

The historical catalog contains 13 categories; canonical metadata currently contains 12. Do not normalize capitalization or collapse `None` and `NONE`. The explorer builds its filters from canonical records and does not infer missing values from this historical catalog. Establish and document the definition of Trait Count before enabling it.
