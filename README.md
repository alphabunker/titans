# House of Titans · Collection Insights

A dependency-free, responsive collection explorer prototype. All 24 NFTs, trait values, and geometric artwork are **fictional samples**, not real Cardano assets, wallet holdings, prices, or rarity rankings.

## Preview

Requires Node.js 22 or newer. No install or API keys needed.

```sh
npm run dev
```

Open http://localhost:5173 in your desktop browser. Stop with Ctrl+C. The preview server binds to localhost and serves only the page and source assets. No hosting or domain setup is included. On a phone, source and PR review are available on GitHub; running this local preview requires a computer or a development environment with port forwarding.

```sh
npm run check
npm test
```

## Features

- Responsive grid and horizontally scrollable table views
- Name/number search, metadata-derived trait filters, number sorting, reset and empty states
- Local saved items (optional browser storage; no wallet implication)
- NFT detail dialog with native keyboard focus management and Escape dismissal
- No runtime packages, remote fonts, trackers, credentials, wallet transactions, or backend

## Structure and integration boundary

`src/data.js` supplies the async collection provider and sample records. Replace that adapter with normalized, verified metadata; keep wallet ownership retrieval in a separate provider. `src/explorer.js` owns pure filtering/sorting. `src/app.js` renders with DOM text nodes so metadata is not interpreted as HTML. `src/style.css` owns responsive layout and theme tokens.

Future integration must verify the collection policy ID and metadata source, paginate large collections, validate remote image URLs, and label data provenance and loading/error states. Do not put API secrets in browser code. Wallet connections are intentionally not implemented.

## Reference verification / outstanding inputs

- https://mugello.io/collection-insights/ was not retrievable. No claim is made that this prototype reproduces its exact features or layout.
- https://app.houseoftitans.io/ redirects to login. The current charcoal/copper theme and typographic monogram are provisional, not verified official branding.
- Confirmed collection: [House Of Titans on Wayup](https://www.wayup.io/collection/53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad), policy `53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad`. This is the Titans collection, not Strongholds.
- Verified property names: Back, Background, Class, Eyes, Face, Hand, Head, House, Outfit, Skin, Special, Type. Wayup also lists Trait count, reserved for derivation from real metadata. The retrieved page did not expose property values: every current value is explicitly Sample A/B/C, and all combinations remain fictional.
- Official NFT imagery, logo, trait values, and screenshots of the authenticated reference are still needed for visual fidelity.

## Validation limits

Automated checks cover JavaScript syntax and filtering, sorting, metadata-derived options. Desktop/mobile CSS is implemented, but no browser-based visual or interaction QA has been completed in the current environment. Before merging, check grid/table at 390px and 1440px, filter intersections, saved state after reload, keyboard-only navigation, dialog focus/Escape, and empty/reset behavior.
