# Canonical metadata contract

The canonical contract is the only collection shape consumed by persistence, snapshots, analytics, and the browser. `src/contracts.js` validates the boundary and `src/metadata-normalizer.js` performs provider-independent CIP-68 normalization.

## Field provenance

| Field | Kind | Rule |
| --- | --- | --- |
| `policyId`, `assetId`, `referenceAssetId`, `rawAssetNameHex` | On-chain identity | Preserve exactly; require the verified policy |
| `rawAssetName` | Decoded | UTF-8 printable decoding only; otherwise `null` |
| `displayName` | On-chain metadata | Preserve exact non-empty string; otherwise `null` |
| `number` | On-chain or derived | Prefer explicit positive metadata number; otherwise trailing asset-name digits; otherwise `null` |
| `numberSource` | Derived provenance | `metadata`, `asset-name`, or `null` |
| `imageUri` | On-chain metadata | Preserve original non-empty URI; otherwise `null` |
| `imageCid` | Derived | Extract only from an `ipfs://` URI; otherwise `null` |
| trait `category` and `value` | On-chain metadata | Preserve spelling, whitespace, and casing; do not merge `None` and `NONE` |
| normalized trait keys | Derived | Unicode NFKC, trim, and lowercase for comparison only |
| `metadataHash` | Import evidence | Hash of the provider-extracted metadata input using the importer-defined canonical serialization |
| `source` | Import evidence | Provider, retrieval time, and optional block height/time |

Absent values are represented as `null` or omitted from the trait array. UI fallbacks may label an unavailable field, but they must not be written back as canonical metadata.

## Trait extraction

The normalizer prefers an object-valued `attributes` map, then an object-valued `traits` map. If neither exists, non-reserved top-level scalar metadata fields are treated as traits. Arrays, nested objects, empty names, empty values, and null values are not flattened or invented; the importer records them as normalization warnings for later review.

## Collection invariants

A publishable full snapshot must eventually establish all of the following in the ingestion validation report:

- verified policy ID;
- 6,500 unique canonical user assets;
- no duplicate asset IDs;
- valid user/reference-token relationships where reference metadata is required;
- one deterministic normalized record and metadata hash per asset;
- supported schema, contract, and normalization versions;
- all referenced immutable artifacts present with matching hashes.

Malformed individual records may be retained as raw evidence, but a candidate that violates a publication invariant cannot replace the active snapshot.

## Versioning

- `contractVersion` changes when a public shape or validation requirement changes.
- `normalizationVersion` changes when a transformation or derivation rule changes.
- `rulesVersion` changes when analytics, Pyramid, rarity-band, pairing, or curated-set rules change.
- A snapshot and its analytics must identify matching snapshot IDs; clients reject incompatible major contract versions.

