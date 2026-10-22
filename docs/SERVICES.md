# Service ownership and provisioning checklist

No account, paid plan, custom domain, database, bucket, deployment, or secret is created by Story 01.1. Provision only when the corresponding implementation story begins and the project owner approves any paid activation.

## Service register

| Service | Initial use | Expected initial tier | Credential location | Replace with |
| --- | --- | --- | --- | --- |
| Koios | Primary metadata and holdings provider | Registered Free | GitHub/Cloudflare server secret | Any `MetadataProvider`; Blockfrost is planned fallback |
| Blockfrost | Verification and failover | Free where sufficient | GitHub/Cloudflare server secret | Another conforming Cardano indexer |
| Cloudflare Pages | Static frontend and previews | Free | Deployment integration | Static host plus compatible edge/runtime routes |
| Cloudflare Workers | Snapshot and portfolio routes | Free | Secret bindings | Compatible serverless HTTP runtime |
| Cloudflare D1 | Canonical materialized view and run lineage | Free | Binding, not browser credential | SQL store behind repository adapter |
| Cloudflare R2 | Immutable artifacts and backups | Free | Binding, not browser credential | Object store behind snapshot adapter |
| Pinata | IPFS HTTP delivery | Free in development; Picnic considered for launch | Gateway configuration/secret binding | Compatible IPFS gateway |
| GitHub Actions | CI, scheduled importer, controlled deploys | Included allowance | GitHub Environments | Other CI runner using the same commands/contracts |
| Workers Logs / Web Analytics | Server diagnostics and privacy-conscious traffic telemetry | Included | Cloudflare project access | Approved observability service |

## Provisioning checklist

- [ ] Confirm the service owner and recovery contact.
- [ ] Confirm free-tier limits and configure usage/billing alerts where supported.
- [ ] Obtain explicit approval before enabling a paid plan or buying a domain.
- [ ] Create separate preview and production resources.
- [ ] Issue least-privilege, separate preview and production credentials.
- [ ] Store credentials only in the appropriate GitHub Environment or Cloudflare secret binding.
- [ ] Verify secrets are redacted from job output and runtime logs.
- [ ] Record resource names/IDs in deployment configuration only after creation.
- [ ] Exercise a non-production request before enabling production access.
- [ ] Document export, rollback, credential rotation, and vendor replacement procedures.

## Review triggers

Reassess architecture and costs at the thresholds accepted in Epic #3: Koios 40,000 requests/day, Workers 75,000 requests/day, D1 75,000 writes/day or 4 million reads/day or 4 GB stored, R2 8 GB or 8 million reads/month, Pinata 80% of any allowance, GitHub Actions 70% of included minutes, or a compressed browser payload above 2 MiB.

Service status, billing, and access are operational facts. Verify them in the relevant provider console before provisioning or launch rather than relying on this repository as a live status record.

