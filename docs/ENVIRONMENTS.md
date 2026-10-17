# Environments and configuration

## Boundaries

| Environment | Data | Infrastructure | Deployment | Secrets |
| --- | --- | --- | --- | --- |
| Local | Developer-generated validated snapshot projected through `/api/collection` | Local server and ignored R2-shaped artifacts | Developer command only | Ignored `.env`/`.dev.vars`; never committed |
| Preview | Stable non-production snapshot | Preview Pages project/bindings | Automatic pull-request preview | GitHub preview environment and Cloudflare secret bindings |
| Production | Validated active canonical snapshot | Production Pages, Worker, D1, R2, and approved gateway | Protected default branch plus separate metadata workflow | Protected GitHub production environment and least-privilege Cloudflare bindings |

Preview must not write production D1/R2 data or publish the production pointer. Production metadata publication stays separate from frontend deployment so a refresh never requires a code commit.

The repository defines `preview` and `production` deployment jobs. Both GitHub
environments exist. Preview is configured with the non-production Pages, D1,
and R2 resource variables plus a least-privilege Cloudflare deployment token.
Production has a `main`-only deployment branch rule;
its resource variables and secrets remain unset until separate production
resources are approved. Add a required reviewer if the repository plan exposes
that protection rule. Workflow files name the environments, while repository
settings own their reviewer and branch protections.

The repository's `main` rule is configured to require pull requests and the
GitHub Actions `verify` check. GitHub currently reports that enforcement on
this private organization repository requires a Team or Enterprise plan; the
rule remains configured but is not an enforceable launch gate on the current
plan.

## Configuration classes

Browser-safe values may include:

- application environment label;
- public same-origin snapshot and portfolio route paths;
- public Cardano network identifier;
- public image gateway hostname when the gateway is intentionally public;
- contract/schema versions.

Server-only secrets include:

- Koios API token;
- Blockfrost project ID;
- Cloudflare API/deployment credentials;
- D1/R2 administrative credentials;
- private Pinata gateway or administration credentials.

Copy `.env.example` only for local development. Real values belong in environment secret stores. Do not add secrets to `wrangler.toml`, browser JavaScript, generated snapshots, workflow logs, fixtures, screenshots, or documentation.

## Naming convention

Use explicit suffixes for cloud resources once provisioned:

- `titans-preview-*` for preview resources;
- `titans-production-*` for production resources.

Local emulation uses local files and never reuses production identifiers. Exact Cloudflare-generated IDs are intentionally absent from source control until provisioning is approved.

## Rotation and failure

- Record the human owner and purpose for each credential in the provider account, not in the secret value.
- Prefer narrowly scoped tokens and separate preview/production credentials.
- Rotate immediately after suspected exposure and according to the owning service's supported schedule.
- Revoke superseded credentials after the replacement workflow succeeds.
- A missing credential must fail the server-side operation with a redacted diagnostic; it must not fall back to a browser-visible token.
