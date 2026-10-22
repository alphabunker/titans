# House of Titans explorer context

## Product boundary

This repository contains a dependency-free Cardano NFT collection explorer for **House Of Titans**. The preview environment serves the complete validated collection and matching analytics from private R2 through same-origin Cloudflare Pages Functions. The Fortress provides equal read-only CIP-30 wallet and manual-address paths over the separate ephemeral portfolio route, then derives the owner summary, collection character, Unexpected Pairings, five-rank Pyramid, Rare Details explorer, and nine approved mini-collections locally.

- Repository: `alphabunker/titans`
- Default branch: `main`
- Implementation branch: `feat/collection-explorer`
- Pull request: https://github.com/alphabunker/titans/pull/1
- Policy ID: `53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad`
- Wayup: https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad

This is House Of Titans, not Strongholds.

## Provenance rules

The taxonomy in `src/trait-catalog.js` was transcribed from the collection filters at https://cnft.tools/hot on 2026-10-14. It is a source snapshot, not a live supply statement. Exact spelling and capitalization are preserved, including distinct `None` and `NONE` values. A trailing space observed after `House Of Undead` was normalized because it appeared to be presentation whitespace.

The active public snapshot contains all 6,500 canonical CIP-68 records. Names, numbers, image identities, classes, and traits come from that snapshot. The source-observed taxonomy remains a historical comparison reference; it is not used to assign or fill missing NFT metadata. `Trait Count` remains catalog-only because it is absent from canonical metadata.

## Architecture

- `src/trait-catalog.js`: historical source-observed taxonomy reference
- `functions/api/collection.js`: verified, cached R2-to-browser route
- `functions/api/analytics.js`: verified, cached active analytics route
- `functions/api/health.js`: fail-closed snapshot identity and staleness route
- `functions/api/portfolio.js`: validated, rate-limited, non-persistent holdings route
- `src/cardano-address.js`: dependency-free Bech32, address-type, and mainnet validation
- `src/portfolio.js`: provider-independent public portfolio projection
- `src/fortress-entry.js`: CIP-30 discovery, read-only address access, and shared browser portfolio lookup
- `src/public-snapshot.js`: compact public collection contract and projection
- `src/data.js`: validated same-origin public snapshot provider
- `src/contracts.js`: executable canonical data, analytics, portfolio, and provider boundaries
- `src/explorer.js`: pure search/filter/sort behavior
- `src/app.js`: accessible DOM rendering and local saved-state behavior
- `src/style.css`: responsive presentation

The accepted production system and service decisions are documented in `docs/ARCHITECTURE.md`, `docs/ENVIRONMENTS.md`, `docs/SERVICES.md`, `docs/OPERATIONS.md`, and `docs/adr/`. Metadata providers normalize into versioned contracts rather than expose vendor payloads. Wallet ownership remains a separate, ephemeral adapter. Never ship API secrets in browser code.

## Known reference limits

- Mugello collection insights was not retrievable in the earlier environment, so exact feature parity is not claimed.
- The authenticated House of Titans inventory app was inspected on 2026-10-14. Its verified UI palette is now used: fallback `#0A0A0E`, app surface `#16161E`, light surface `#1F1F28`, selected/contrast surface `#272734`, hot purple `#AB8BAD`, and purple gradient endpoint `#A463A8`. The live app's transparent `favicon/64x64.png` is now used for the header logo; the layout and other brand assets remain provisional.
- Official NFT imagery, real token metadata, the read-only holdings service, The Fortress entry UI, owner summary, collection character, Unexpected Pairings explorer, five-rank Pyramid tracker, Rare Details explorer, and nine Titan mini-collections are integrated. Prices, marketplace listings, transactions, access gating, and ownership proof are not.
