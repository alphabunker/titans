# House of Titans · Collection Insights

A dependency-free, responsive collection explorer backed by the complete validated House of Titans CIP-68 metadata snapshot. The browser receives a compact, same-origin projection of the active immutable snapshot; it never calls a blockchain provider directly.

## Preview

Requires Node.js 22 or newer. No install or API keys are needed after generating or obtaining the ignored local snapshot artifacts.

```sh
npm run dev
```

Open http://localhost:5173 in your desktop browser. Stop with Ctrl+C. By default, the local server projects the active snapshot under `.data/publication-story8/r2`; override that directory with `TITANS_LOCAL_R2_DIR`.

```sh
npm run check
npm test
npm run validate:public-snapshot
```

The real-metadata importer is server-side and requires provider configuration. See `docs/IMPORTER.md`; its local output remains under ignored `.data/` and cannot replace production data.

## Features

- Responsive grid and horizontally scrollable table views
- Name/number search, metadata-derived trait filters with counts, number sorting, reset and empty states
- Local saved items (optional browser storage; no wallet implication)
- NFT detail dialog with native keyboard focus management and Escape dismissal
- Lazy, validated IPFS imagery with stable fallbacks and visible CID/URI provenance
- Explicit loading, current, stale, partial, and unavailable snapshot states
- Fixed 48-item result pages so all 6,500 records remain searchable without mounting thousands of cards or images
- Read-only `/api/portfolio` lookup for validated mainnet stake/payment addresses, with private provider credentials, strict policy filtering, ephemeral caching, and rate limiting
- The Fortress tab with equal CIP-30 wallet and manual-address entry paths, refresh/disconnect/clear controls, and explicit zero, partial, wrong-network, rejection, and provider-failure states
- Owner summary, versioned collection-character highlights, and Unexpected Pairings with owned representative images and local matching-Titan exploration
- No runtime packages, remote fonts, trackers, browser credentials, or wallet transactions

## Structure and integration boundary

`functions/api/collection.js` reads one active R2 pointer, verifies its matching manifest and canonical artifact, and returns a compact public snapshot with cache headers. `functions/api/analytics.js` independently verifies and serves the matching precomputed analytics artifact. `functions/api/portfolio.js` validates a submitted address and calls the server-side Koios adapter without persisting the address or holdings. `src/public-snapshot.js` defines the browser collection contract; `src/cardano-address.js` and `src/portfolio.js` define the read-only holdings boundary. `src/data.js` validates the same-origin responses. `src/analytics.js` joins owned IDs to the precomputed indexes for local Fortress insights. `src/contracts.js` defines the canonical asset, snapshot, analytics, portfolio, and provider boundaries. `src/explorer.js` owns pure filtering, counts, and sorting. `src/app.js` renders metadata with DOM text nodes so it is not interpreted as HTML.

The production foundation is documented in:

- `docs/ARCHITECTURE.md` — system shape, components, contracts, and data flows
- `docs/ANALYTICS.md` — precomputed traits, pairs, rarity, Pyramid, curated indexes, and payload budget
- `docs/CANONICAL_DATA.md` — field provenance, normalization rules, invariants, and versioning
- `docs/ENVIRONMENTS.md` — local/preview/production and secret boundaries
- `docs/IMPORTER.md` — Koios ingestion, checkpoint, validation, and workflow behavior
- `docs/PUBLIC_DATA.md` — public snapshot route, cache/version safety, UI states, and performance budgets
- `docs/PORTFOLIO.md` — read-only address lookup, response states, privacy, cache, and abuse controls
- `docs/STORAGE.md` — D1 schema, immutable R2 layout, activation, and recovery
- `docs/SERVICES.md` — ownership, provisioning, costs, and replacement checklist
- `docs/adr/` — accepted architecture decisions
- `.env.example` — names of server-side configuration values, with no credentials

See `docs/PROJECT_CONTEXT.md` and `docs/TRAIT_CATALOG.md` for durable project and provenance notes.

Do not put API secrets in browser code. The wallet bridge requests only CIP-30 public-address access; it does not request signatures, transactions, private keys, or seed phrases.

## Reference verification / outstanding inputs

- https://mugello.io/collection-insights/ was not retrievable. No claim is made that this prototype reproduces its exact features or layout.
- The authenticated inventory view at https://app.houseoftitans.io/inventory was inspected on 2026-10-14. The site now uses its verified dark backgrounds, purple accents, and official header logo; the layout and other brand assets remain provisional.
- Confirmed collection: [House Of Titans on Wayup](https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad), policy `53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad`. This is the Titans collection, not Strongholds.
- Canonical metadata currently supplies 12 trait categories: Back, Background, Class, Eyes, Face, Hand, Head, House, Outfit, Skin, Special, and Type. Exact source casing is retained, including `None` and `NONE`.
- Trait Count remains a historical taxonomy reference but is not assigned or filterable because it is absent from canonical metadata.
- Names, NFT imagery, and trait values now come from the complete active snapshot. The Fortress entry, holdings lookup, owner summary, collection character, and Unexpected Pairings explorer are available; later Fortress sections remain future stories.

## Validation limits

Automated checks cover JavaScript syntax, canonical/public contracts, pointer-version safety, filtering, counts, sorting, IPFS delivery, CIP-30 address conversion, Fortress portfolio states, and complete-snapshot reconciliation. Browser QA should cover grid/table and Fortress entry at mobile and desktop widths, pagination, filter intersections, saved state after reload, keyboard-only navigation, dialog focus/Escape, wallet rejection, manual address lookup, and empty/reset behavior.
