# Titan image delivery

Canonical metadata keeps the original `ipfs://` URI and derived CID. The
browser resolves that identity through a replaceable HTTPS gateway host; the
gateway URL is delivery configuration and never replaces the canonical URI.

## Browser behavior

- `src/media.js` accepts only an HTTPS host with no credentials, path, query,
  or fragment. Tokens cannot be placed in browser configuration.
- Local and preview builds default to the public `gateway.pinata.cloud` host.
  A public dedicated host can replace it through the
  `titans-ipfs-gateway` meta value without changing collection records.
- Images begin loading only when they approach the viewport. Requests omit
  credentials, time out after 12 seconds, reject responses over 12 MiB, and
  accept only AVIF, GIF, JPEG, PNG, or WebP MIME types.
- The square media frame, explicit 800×800 dimensions, and fallback remain
  stable while loading or after any error. Original URI and CID are retained
  as provenance on each media element.

The client fetches visible media as blobs so it can validate MIME and byte
limits before display. Object URLs are revoked after the browser decodes the
image.

## Configuration and secrets

Use a public, origin-restricted dedicated gateway host for launch. Do not put
a Pinata gateway token, JWT, API key, or secret in HTML, JavaScript, query
parameters, generated metadata, or logs. If a future gateway requires a
secret, terminate that request in a same-origin Worker and keep the secret in
a Cloudflare binding.

## Pinning authority

No pinning is performed by this repository or deployment workflow. Before
pinning any collection CID, record confirmation that the project is
authorized to maintain that content, the approving owner, the intended
retention period, and the removal process. Pinning improves availability; it
does not change the on-chain CID or grant content rights.

## R2 mirror/cache triggers

Do not bulk-copy the 6,500 originals to R2 initially. Reconsider an authorized
mirror or bounded cache when measured evidence shows one of these conditions:

- repeated gateway errors or p95 image latency outside the launch objective;
- Pinata request, bandwidth, storage, or file usage reaches 80% of allowance;
- origin restrictions cannot support local, preview, and production safely;
- availability requires a second independently operated delivery path.

Any mirror must retain CID-to-object provenance, validate MIME and maximum
size before storage, use immutable cache keys, and document deletion rights.

## Validation

Unit tests cover gateway replacement, credential rejection, CID safety,
timeouts, MIME checks, size limits, and HTTP failures. A small real-media check
is available without exposing credentials:

```sh
npm run validate:images -- \
  --input .data/full-bootstrap-story8/collection.candidate.json \
  --sample-size 3
```
