# ADR 0002: Data and security boundaries

- Status: Accepted
- Date: 2026-10-17
- Epic: GitHub issue #3

## Context

On-chain metadata, remote media, provider responses, and visitor-submitted addresses are untrusted or sensitive in different ways. The application needs traceability without retaining unnecessary wallet information.

## Decision

- Canonical records retain on-chain identity, metadata hash, provider, retrieval time, and normalization version.
- Raw provider payloads remain ingestion evidence and never become browser contracts.
- Missing traits are not inferred. Source spelling/casing is retained separately from normalized comparison keys.
- Candidate snapshots become active only after collection-level validation; rollback retains the previous pointer.
- Addresses and holdings are processed ephemerally and are not persisted by default.
- A manual address is not proof of control. Initial Fortress access has no ownership gate or CIP-8 authentication.
- Metadata/media are validated and rendered as data, never executable markup.
- Server credentials remain in protected secret stores and are redacted from output.

## Consequences

Analytics and UI code operate on stable, versioned contracts. Debugging preserves enough provenance to reproduce import decisions. Product analytics cannot silently become wallet tracking, and any future authentication or persistence requires a separate reviewed decision.

