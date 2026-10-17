# Read-only Titan portfolio boundary

`POST /api/portfolio` with a JSON body shaped as `{ "address": "<bech32-address>" }`
resolves current House of Titans
holdings without exposing provider credentials or persisting the submitted
wallet data. It is a lookup, not proof that the visitor controls the address.

## Accepted input

- Mainnet Shelley payment addresses using the `addr1` prefix.
- Mainnet stake addresses using the `stake1` prefix.
- The Bech32 checksum, address header, prefix, and network ID must agree.

Malformed input returns `invalid_address`. A valid non-mainnet address returns
`wrong_network`. Byron/base58 and non-address Bech32 values are not accepted by
this initial boundary because the Koios address endpoints used here accept
Bech32 payment and stake addresses.

For a stake address, the Koios adapter resolves all associated payment
addresses. For a base payment address, it reads the associated stake address
and resolves that account's payment addresses; an enterprise address is
queried by itself. Only positive-quantity CIP-68 user tokens under the verified
House of Titans policy are returned.

## Success contract

```json
{
  "contractVersion": "1.0.0",
  "network": "mainnet",
  "retrievedAt": "2026-10-17T20:00:00.000Z",
  "status": "complete",
  "addressKind": "stake",
  "ownershipProof": false,
  "assetIds": []
}
```

An empty `assetIds` array is a successful zero-holdings result. HTTP 206 and
`status: "partial"` mean at least one resolved-address batch succeeded and at
least one failed. The endpoint distinguishes `invalid_address`,
`wrong_network`, `rate_limited`, `upstream_timeout`, and
`upstream_unavailable` errors.

## Privacy, caching, and abuse controls

- Submitted addresses and holdings are not written to D1, R2, analytics, or
  application logs.
- The address is sent in a POST body instead of the URL so it does not appear
  in ordinary URL/access-log fields.
- Successful responses are cached for 30 seconds in isolate memory and marked
  `private`; failures use `no-store`.
- Client request buckets are also isolate-local and allow 30 requests per
  minute. This is a bounded first defense, not a globally coordinated quota.
- Koios credentials are read only from server-side `KOIOS_API_TOKEN` and are
  never included in the response or browser bundle.
- Provider calls time out after eight seconds and retry once for retryable
  failures.

The boundary is intentionally read-only. It does not authenticate a visitor,
connect a wallet, request a signature, submit a transaction, or establish
ownership.
