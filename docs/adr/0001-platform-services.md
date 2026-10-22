# ADR 0001: Initial platform services

- Status: Accepted
- Date: 2026-10-17
- Epic: GitHub issue #3

## Context

House of Titans needs a production path for a 6,500-item CIP-68 collection without putting blockchain fan-out or credentials in the browser. The first architecture should be inexpensive, recoverable, and replaceable.

## Decision

- Use Koios registered Free through a provider adapter; keep Blockfrost as verification/failover.
- Run the Node.js importer in GitHub Actions on bootstrap, daily schedule, and manual dispatch.
- Use Cloudflare D1 for canonical normalized records and ingestion lineage.
- Use Cloudflare R2 for immutable snapshots, manifests, reports, and exports.
- Use a cached same-origin Pages Function/Worker for the active snapshot and a narrow portfolio endpoint.
- Host the static frontend on Cloudflare Pages with local, preview, and production boundaries.
- Resolve IPFS images through configurable Pinata delivery while retaining the on-chain URI/CID.
- Use GitHub Actions and Cloudflare's built-in logs/analytics initially.

## Consequences

The browser stays fast and credential-free, and the collection remains usable during provider outages through the last-known-good snapshot. The project takes on schema migrations, snapshot publication, service configuration, and recovery runbooks. Vendor-specific code must remain behind the contracts described in `docs/ARCHITECTURE.md`.

This decision authorizes implementation planning. It does not authorize paid-plan activation or production provisioning.

