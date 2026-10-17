# Collection analytics

`buildCollectionAnalytics` deterministically derives the compact collection-wide indexes used by The Fortress. It operates on a single canonical snapshot and emits the same `snapshotId` plus a versioned rules identifier.

## Precomputed values

- global count, percentage, and rarity band for every normalized category/value pair;
- global support count for every eligible cross-category trait pair;
- asset-position indexes for individual traits and classes;
- a canonical asset-ID order and per-asset trait-key index so owner analytics
  need only the owned asset IDs returned by the holdings boundary;
- the approved five-tier Pyramid class indexes and a separate Titan index;
- membership indexes for approved, versioned mini-collection rules.

Pair indexes intentionally store global counts rather than repeating asset IDs for every pair. When a visitor opens one pairing, the browser can scan the 6,500 canonical assets for that pair. This reduces the published payload while still avoiding a blockchain or provider request.

## Exclusions and identity

- Pairing generation excludes same-category pairs.
- Placeholder-normalized values such as `None` and `NONE` are excluded from pairings, while their original source values remain in global trait frequencies.
- Every placeholder-like frequency is explicitly marked with
  `placeholderLike` and its feature-specific default exclusions. This keeps
  the underlying fact queryable without presenting it as collection
  character or an unexpected pairing.
- An asset contributes at most once to a normalized trait or pair count.
- Index arrays contain zero-based positions in the matching canonical snapshot, not duplicated asset IDs.

## Payload budget

Generate and measure a candidate analytics file with:

```sh
npm run analytics -- --input .data/import/collection.candidate.json --output .data/import/analytics.json
```

The command reports raw and gzip byte counts and exits with status 2 if the compressed file exceeds 2 MiB. Crossing that threshold requires a documented sharding or narrow-read-API decision before publication.

Benchmark the serialized artifact and owner-only lookups with:

```sh
npm run benchmark:analytics -- \
  --snapshot .data/full-bootstrap-ordered/collection.candidate.json \
  --analytics .data/analytics-story8/analytics.json \
  --iterations 500
```

The full 6,500-asset rules-version 1.1.0 artifact measured 4,711,196 bytes
raw and 471,139 bytes gzip on 2026-10-17, well below the 2 MiB target. R2
publication validates that analytics reference the same snapshot and asset
count, then writes `analytics.json` before the atomic `latest.json` pointer
changes.

## Rule versions

`src/fortress-rules.js` owns the initial Pyramid, rarity, collection-character, Unexpected Pairings, and mini-collection boundaries. Mini-collection rules are supplied as approved configuration and embedded with their own version. A change to precomputed analytics semantics increments `FORTRESS_RULES_VERSION` and regenerates the analytics artifact; browser-only feature rules carry their own version. Rules version 1.1.0 added explicit placeholder flags and the owner-only lookup indexes. Rules version 1.2.0 adds deterministic any-of clauses and the nine approved mini-collection definitions; it does not change the approved Pyramid or rarity thresholds.

## Owner summary and collection character

The owner summary counts only portfolio asset IDs present in the active
canonical analytics index. Its collection percentage uses 6,500 as the fixed
denominator and displays two decimal places. Classes represented is the number
of distinct normalized on-chain `Class` values among those owned assets.

Collection-character rule `1.0.0` is defined in `src/fortress-rules.js`:

- fewer than three owned Titans produces a low-evidence state and no trait
  highlights;
- wallets with three through nine Titans require at least two matching owned
  Titans; wallets with ten or more require at least three;
- placeholder-like values and traits excluded from collection character are
  omitted;
- a highlight must have at least `1.10×` lift, where lift is the owner's trait
  share divided by the complete collection's trait share;
- results are ordered by lift descending, owned count descending, collection
  count ascending, category ascending, then value ascending, and are limited
  to four;
- the first matching owned asset in canonical index order supplies the
  representative image, while every matching owned index remains available to
  the local detail interaction.

Changing highlights or opening matching Titans reads only in-memory indexes and
does not call Koios or another blockchain provider.

## Unexpected Pairings

Unexpected Pairings rule `1.0.0` is defined in `src/fortress-rules.js`. The
owner calculation starts only with cross-category pairs already present in an
owned Titan and applies these eligibility rules:

- the pair must occur on at least two canonical Titans, which removes unique
  combinations that have no collection counterpart to explore;
- its complete-collection support must be no more than 2% of the active
  snapshot;
- placeholder-like values, feature-excluded traits, same-category pairs, and
  duplicate normalized traits remain excluded;
- owner lift must be at least `1.25×`, where lift is the share of owned Titans
  containing the pair divided by the pair's share of the complete collection.

Eligible pairs receive a deterministic surprise score:

`owner lift × log2(collection asset count ÷ pair collection count)`

Results sort by score descending, owned support descending, collection support
ascending, left normalized trait key ascending, then right normalized trait
key ascending. The first three are shown. The first matching owned canonical
index supplies the card image. For each result, the browser intersects the two
precomputed trait indexes and verifies that the derived complete and owned
subsets exactly match the stored pair and owner counts before returning the
result.

The **Meet the collection** and **Your Titans** views reuse those in-memory
indexes. Switching views, opening NFT details, and dismissing the dialog do not
call Koios or another blockchain provider. The dialog uses native modal focus
containment and Escape behavior; its tabs expose tab/tablist/panel semantics,
arrow/Home/End keyboard navigation, counts in their accessible names, and
return focus to the invoking card when dismissed.

## Five-rank Titans Pyramid

Pyramid rule `1.0.0` is versioned in `src/fortress-rules.js`, not in UI
markup. One complete pyramid requires 15 ranked NFTs: one Royal, two Mystics,
three Military, four Townsfolk, and five Peasants. The `Titan` class has its
own index and count and is never included in completion math. No enhanced,
crowned, or special variant exists in this rule.

For each required class, owner analytics intersects the class index with the
owned canonical indexes. Completed pyramids are the limiting whole-number
quotient:

`min(floor(Royal ÷ 1), floor(Mystic ÷ 2), floor(Military ÷ 3), floor(Townsfolk ÷ 4), floor(Peasant ÷ 5))`

The next target is `completed + 1`. Each tier's exact shortage is
`max(0, required per pyramid × next target − owned)`. The overall remaining
count is the sum of those five shortages, so surplus NFTs from one rank cannot
hide a shortage in another.

Selecting a rank opens the exact matching owned indexes and the complete
canonical class index. Candidate results mount 48 at a time and retain lazy
image loading. Tabs provide tab/tablist/panel semantics plus Arrow/Home/End
navigation; native modal Escape/focus containment and return-focus behavior
match the pairing explorer. Rank browsing, pagination, and NFT detail opening
use loaded in-memory data and make no blockchain-provider calls.

## Rare Details

Rare Details rule `1.0.0` is defined in `src/fortress-rules.js`. It assigns
every non-placeholder normalized category/value pair to exactly one band using
its complete-collection percentage:

- Legendary: below 1%;
- Epic: 1% to below 3%;
- Rare: 3% to below 6%;
- Uncommon: 6% to below 15%;
- Common: 15% and above.

The initial view shows Legendary, Epic, and Rare details. **Show all traits**
adds Uncommon and Common so the view covers the full supported vocabulary.
Placeholder-like values such as `None` and `NONE` remain available in the
underlying frequency data for reconciliation but are intentionally excluded
from this feature; the UI reports how many normalized placeholder entries were
excluded.

Each detail reports its canonical collection count and percentage, the exact
owned count and owner-collection percentage, and whether it is owned or still
to collect. Its representative image is the first owned match in canonical
order when available, otherwise the first collection match. Selecting a detail
opens its complete matching collection and the owned subset in an accessible
tabbed dialog. Candidate results mount 48 at a time, the overview mounts at
most 36 additional cards per action, and all calculation and exploration use
the loaded in-memory snapshot without a blockchain-provider call.

Rarity labels are descriptive metadata summaries only. They are not prices,
investment guidance, marketplace rankings, or an official value score.

## Mini-collections

Mini-collection rule `1.0.0` evaluates an AND across each definition's clauses
and an OR across the canonical values inside a clause. Every definition stores
its name, description, transparent rule text, rule version, and matching
canonical asset positions in the analytics artifact. There are no hand-picked
exceptions.

Owner analytics intersects those published positions with the verified owned
asset positions to produce the owned count, total count, owner share, owned
subset, and an image composition that prefers owned matches. The complete and
owned views use the same accessible, bounded in-memory exploration pattern as
the other Fortress sections and make no additional blockchain-provider call.

The nine approved definitions, full-snapshot counts, collision review, and
approval record are documented in `docs/MINI_COLLECTIONS.md`.
