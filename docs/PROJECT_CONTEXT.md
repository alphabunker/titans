# House of Titans explorer context

## Product boundary

This repository currently contains a free, local-first Cardano NFT collection explorer for **House Of Titans**. The prototype remains dependency-free while Epic #3 adds a production architecture for real metadata, hosting, and read-only holdings. No production service has been provisioned yet.

- Repository: `alphabunker/titans`
- Default branch: `main`
- Implementation branch: `feat/collection-explorer`
- Pull request: https://github.com/alphabunker/titans/pull/1
- Policy ID: `53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad`
- Wayup: https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad

This is House Of Titans, not Strongholds.

## Provenance rules

The taxonomy in `src/trait-catalog.js` was transcribed from the collection filters at https://cnft.tools/hot on 2026-10-14. It is a source snapshot, not a live supply statement. Exact spelling and capitalization are preserved, including distinct `None` and `NONE` values. A trailing space observed after `House Of Undead` was normalized because it appeared to be presentation whitespace.

The 24 records in `src/data.js` are synthetic fixtures. They combine verified vocabulary only so the full filter UI can be exercised. The combinations, names, numbers, and geometric artwork do not represent real NFTs. `Trait Count` remains catalog-only because its calculation has not been verified against actual metadata.

## Architecture

- `src/trait-catalog.js`: verified taxonomy snapshot and the filterable subset
- `src/data.js`: collection identity, synthetic fixtures, async provider boundary
- `src/contracts.js`: executable canonical data, analytics, portfolio, and provider boundaries
- `src/explorer.js`: pure search/filter/sort behavior
- `src/app.js`: accessible DOM rendering and local saved-state behavior
- `src/style.css`: responsive presentation

The accepted production system and service decisions are documented in `docs/ARCHITECTURE.md`, `docs/ENVIRONMENTS.md`, `docs/SERVICES.md`, and `docs/adr/`. Future metadata providers must normalize into the versioned contracts rather than expose vendor payloads. Wallet ownership remains a separate, ephemeral adapter. Validate policy IDs and remote image URLs, paginate large datasets, expose data provenance, and never ship API secrets in browser code.

## Known reference limits

- Mugello collection insights was not retrievable in the earlier environment, so exact feature parity is not claimed.
- The authenticated House of Titans inventory app was inspected on 2026-10-14. Its verified UI palette is now used: fallback `#0A0A0E`, app surface `#16161E`, light surface `#1F1F28`, selected/contrast surface `#272734`, hot purple `#AB8BAD`, and purple gradient endpoint `#A463A8`. The live app's transparent `favicon/64x64.png` is now used for the header logo; the layout and other brand assets remain provisional.
- Official artwork, real token metadata, trait combinations, prices, rarity, and supply have not been integrated.
