# Development guidance

- Keep the first milestone local-only. Do not deploy, purchase a domain, or add paid services unless requested.
- Preserve explicit demo labels until live data is verified. Never invent official collection metadata, rarity, class names, or holdings.
- Keep design tokens centralized in styles.css; the palette is provisional pending brand verification.
- Prefer small modules and minimal dependencies. Keep data access separate from presentation when adding live integration.
- Treat addresses, metadata and API responses as untrusted input. Use textContent for external strings; do not inject remote metadata with innerHTML.
- Never commit credentials. Keep provider keys server-side. Wallet integration should request the minimum permissions; never request signatures for holdings lookup.
- Preserve mobile responsiveness, semantic HTML, keyboard operation, contrast and reduced-motion support.
- Run syntax/build checks appropriate to each change. Verify real behavior and edge cases when data integration is added.
