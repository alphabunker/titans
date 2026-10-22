# House of Titans mini-collections

## Approval status

The product owner approved all nine initial names, descriptions, and rules on
2026-10-17 under Story #17. They are the authorized initial release set.

All definitions use rule version `1.0.0`. Membership is a deterministic AND
across the two listed clauses; values inside one clause are OR alternatives.
There are no hand-picked assets or exceptions.

| Theme | Description | Canonical selection rule | Titans |
| --- | --- | --- | ---: |
| Starforged | Born under impossible skies, wearing the House’s galaxy flight colors. | Galaxy `Skin` + Galaxy Bomber Jacket `Outfit` | 18 |
| Crownward | Royals and Titans who carry the crown in plain sight. | Royal or Titan `Class` + Crown, Burning Crown, Skull Crown, or Tiara `Head` | 82 |
| The Arcane Circle | Mystics whose headwear marks them as keepers of forbidden study. | Mystic `Class` + Wizard Hat, Legacy Wizard Hat, or Skull Candle `Head` | 112 |
| The Iron Phalanx | Military ranks armored or uniformed for the Fortress wall. | Military `Class` + Spartan Armor, Spartan Armor with Cape, Heavy Armor, Military Officer, Officer Uniform, or Officer Uniform with Cape `Outfit` | 148 |
| Night Blades | Eastern battle dress paired with a blade carried at the back. | Ninja Puffer Jacket, Ronin Armor, Samurai Armor, Kimono, Fur Kimono, or Flower Kimono `Outfit` + Katana or Curved Blade `Back` | 55 |
| The Dustbound Company | Desert-clad travelers crossing the House’s sun-scoured grounds. | Desert Nomad, Desert Rebel, or Desert Trooper `Outfit` + Sand, Sandstone, or Yellow `Background` | 67 |
| The Skyguard | Winged Titans equipped for flight, orbit, or the void. | Wings, Dark Wings, or Steel Wings `Back` + Flight Jacket, Denim Flight Jacket, Astronaut, Space Warrior Armor, or Astro-HOT `Outfit` | 32 |
| The Gravebound | Undead and skeletal forms bearing a necromancer’s or reaper’s relic. | Purple Zombie, Green Zombie, Headless, Skinned, Translucid Skeleton, Cyber Skeleton, or Skull Ape `Skin` + Necromancy Staff, Reaper Scythe, Skull Hammer, or Skull Wand `Back` | 30 |
| The Violet Circuit | Techwear operatives working against code-lit and violet horizons. | Cyberpunk Jacket, Cyberpunk Elite Jacket, Techwear Coat, Titan Techwear Coat, or Syndicate Coat `Outfit` + Code, Purple, Grape, or Amethyst `Background` | 82 |

## Collision review

Only six of the 36 pairwise comparisons overlap, and no pair shares more than
two Titans:

- Starforged × Crownward: 1
- Crownward × Night Blades: 2
- Crownward × The Gravebound: 2
- Crownward × The Violet Circuit: 1
- The Arcane Circle × The Gravebound: 1
- The Arcane Circle × The Violet Circuit: 1

The overlap is intentional: these are thematic lenses over canonical traits,
not exclusive classifications.

## Reproducibility

`src/fortress-rules.js` is the approved-rule source. The analytics generator
evaluates each clause against normalized canonical traits and publishes the
matching canonical asset positions, rule text, and rule version. Rule edits
change `FORTRESS_RULES_VERSION` and require deterministic analytics
regeneration before deployment.
