# House of Titans architecture

Status: accepted foundation for Epic #3. This document records boundaries; it does not provision services.

## System shape

```text
Koios (primary) / Blockfrost (verification + fallback)
                         |
                GitHub Actions importer
                         |
              validate + normalize CIP-68
                    /             \
          Cloudflare D1       Cloudflare R2
          canonical view      immutable snapshots
                    \             /
                 atomic latest pointer
                         |
        cached same-origin Pages Function/Worker
                         |
        Cloudflare Pages browser application

CIP-30 wallet or entered address
                         |
        rate-limited portfolio Worker endpoint
                         |
       owned asset IDs joined locally to snapshot
```

The browser receives canonical collection and analytics contracts. It does not receive raw provider payloads, provider credentials, D1 access, or R2 credentials. Collection browsing and Fortress interactions run locally after one holdings lookup.

## Components and ownership

| Component | Responsibility | Replacement boundary |
| --- | --- | --- |
| Koios adapter | Policy discovery, CIP-68 metadata, current holdings | `MetadataProvider` in `src/contracts.js` |
| Blockfrost adapter | Verification and documented failover | Same provider interface |
| Importer | Pagination, retry, normalization, validation, run report | Canonical asset/snapshot contracts |
| D1 | Rebuildable canonical query model and ingestion lineage | Repository/storage adapter |
| R2 | Immutable raw/normalized snapshots, manifests, reports, exports | Object-store adapter and snapshot manifest |
| Pages Function/Worker | Cached active snapshot and narrow portfolio endpoint | Public snapshot and portfolio contracts |
| Pages | Static browser application | Same-origin HTTP routes |
| Pinata | HTTP delivery for on-chain IPFS CIDs | Configurable gateway host; CID remains identity |
| GitHub Actions | CI, scheduled/manual ingestion, controlled deployment | Versioned workflows and environment secrets |

## Contract boundaries

`src/contracts.js` is the executable starting point for the interfaces below:

- `MetadataProvider`: vendor adapter used by import and holdings services.
- Canonical asset: normalized CIP-68 identity, display fields, traits, image identity, hash, and source evidence.
- Collection snapshot: a versioned, policy-bound set of unique canonical assets.
- Analytics snapshot: derived indexes tied to one collection snapshot and rules version.
- Portfolio response: ephemeral mainnet asset IDs and retrieval state; it is not proof of ownership.

Raw/on-chain evidence must remain distinguishable from normalized and derived values. Missing values stay missing; normalization must not invent traits. Source spelling and casing remain available even when comparison keys are normalized.

## Data and request flows

### Scheduled metadata publication

1. GitHub Actions invokes the importer with server-only credentials.
2. The provider adapter discovers policy assets and retrieves CIP-68 evidence in bounded batches.
3. Normalization produces canonical assets and validation reports.
4. D1 receives idempotent changed records and ingestion lineage.
5. R2 receives immutable candidate artifacts.
6. Collection-level checks pass before `latest.json` changes atomically.
7. The previous active snapshot remains available for rollback.

### Public collection read

1. The browser requests the active snapshot from a same-origin route.
2. The Worker reads the active pointer/object and applies strong cache headers.
3. The browser validates contract and version compatibility before rendering.
4. Search, sort, filters, saved items, and analytics do not call a blockchain provider.

### Read-only portfolio lookup

1. A visitor grants CIP-30 address access or enters a Cardano address.
2. The browser submits only the required address data to a narrow same-origin endpoint.
3. The endpoint validates network/input, resolves holdings, filters the verified policy, and returns canonical asset IDs plus retrieval state.
4. The browser joins those IDs to the active snapshot. Addresses and holdings are not persisted by default.

## Non-negotiable constraints

- Never ship or log provider, database, deployment, or private gateway credentials.
- Never request seed phrases, private keys, transaction signatures, spending authority, delegation, or transfers.
- Never let a partial import replace the active snapshot.
- Never treat a manually entered address as proof of control.
- Keep providers, storage, media gateway, and hosting behind narrow interfaces.
- Treat blockchain metadata and media as untrusted input.

Detailed decisions are in `docs/adr/0001-platform-services.md` and `docs/adr/0002-data-and-security-boundaries.md`.

