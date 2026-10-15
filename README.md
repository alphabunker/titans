# Titans Collection Insights

Local-first collection dashboard prototype inspired by Mugello's collection insights workflow. No hosting or domain has been configured.

## Run

From this directory, run `python3 -m http.server 8000` and visit http://localhost:8000. There are no dependencies or build step.

## Implemented

- Responsive overview, class pyramid, family completion, rarity bands, collecting ideas, and trait browser.
- Trait search, owned/missing filters, wishlist, family completion goals.
- Wishlist stored locally where browser storage is available.
- Accessible labels, keyboard focus indicators, reduced motion support.

## Prototype boundaries

All names, holdings, counts, rarity frequencies, and classifications are illustrative. No wallet is connected and no Cardano holdings are fetched. The dark charcoal / crimson / warm gold palette is provisional; exact House of Titans colors require a verified screenshot or approved brand tokens. This is an original interface, not a copy of Mugello assets or code.

## Next

1. Confirm Titans brand palette and visual design.
2. Obtain official collection policy ID, metadata, trait definitions, and artwork access.
3. Replace sample data with a normalized collection dataset.
4. Add read-only Cardano address / wallet lookup with server-side API secrets if needed.
5. Validate against real holdings before considering hosting.

## Validation

`node --check app.js` passes. Browser visual and interaction QA remains pending; the reference browser inspection did not complete.
