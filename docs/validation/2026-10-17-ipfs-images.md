# IPFS image delivery — 2026-10-17

Story: [#9 — Deliver resilient Titan imagery from IPFS](https://github.com/alphabunker/titans/issues/9)

## Canonical coverage

- Audited canonical assets: 6,500
- Assets with an original `ipfs://` URI and derived CID: 6,500
- Missing image identities: 0
- Unique image CIDs: 6,494

The display resolver changes only the HTTPS gateway host. Original URI and CID
remain in canonical metadata and are also attached to rendered media elements
as provenance.

## Real-media validation

The public Pinata gateway returned CORS-enabled `image/jpeg` responses for
three canonical samples. The production validation command downloaded each
through the same MIME-, size-, and timeout-checking path used by the browser:

| Titan | CID | Validated bytes |
| --- | --- | ---: |
| Edward North #1 | `QmeiC8Hyv8juMEVK5gZHZVcw9VomyLgNGeBh2U6iPLk1eh` | 588,420 |
| Gotthard #2 | `Qmdq9brNFKmvDjRmbDf2N6dibw7gPHqTQQR7e5YWWwsSHd` | 1,881,569 |
| Prince Grymokar #3 | `QmR3dedhpWijFDDeWdHR4NfVxbH7XzJqRpAsJyxDJtbebA` | 2,507,044 |

## Failure and security behavior

- Intersection Observer starts requests only near the viewport; `<img>` also
  uses native lazy loading and asynchronous decoding.
- A fixed square frame and explicit dimensions prevent layout collapse.
- Missing identity, invalid CID, HTTP errors, non-image MIME, oversized media,
  decode errors, and the 12-second timeout converge on the same stable
  unavailable-image state.
- Gateway configuration rejects HTTP, credentials, paths, query parameters,
  and fragments, preventing a private Pinata token from entering client URLs.
- Supported media is limited to AVIF, GIF, JPEG, PNG, and WebP; SVG and HTML
  are not displayed.

Automated syntax checks and all 54 tests passed. Browser screenshot QA could
not run because no browser surface was available to the automation runtime;
the real network validation and component state tests remain reproducible.

## Operational decision

No CID was pinned and no media was copied to R2. Pinning requires documented
authority. Bulk mirroring remains deferred until measured reliability, quota,
or availability triggers in `docs/IMAGES.md` are reached.
