export const FORTRESS_RULES_VERSION = '1.3.0';

export const PYRAMID_RULE = Object.freeze({
  version: '2.0.0',
  tiers: Object.freeze([
    Object.freeze({ classValue: 'Royal', required: 1 }),
    Object.freeze({ classValue: 'Mystic', required: 1 }),
    Object.freeze({ classValue: 'Military', required: 1 }),
    Object.freeze({ classValue: 'Townsfolk', required: 1 }),
    Object.freeze({ classValue: 'Peasant', required: 1 }),
  ]),
  excludedClass: 'Titan',
  enhancedVersion: null,
});

export const RARITY_BANDS = Object.freeze([
  Object.freeze({ id: 'legendary', label: 'Legendary', minimum: 0, maximumExclusive: 1 }),
  Object.freeze({ id: 'epic', label: 'Epic', minimum: 1, maximumExclusive: 3 }),
  Object.freeze({ id: 'rare', label: 'Rare', minimum: 3, maximumExclusive: 6 }),
  Object.freeze({ id: 'uncommon', label: 'Uncommon', minimum: 6, maximumExclusive: 15 }),
  Object.freeze({ id: 'common', label: 'Common', minimum: 15, maximumExclusive: Infinity }),
]);

export const RARITY_RULE_VERSION = '1.0.0';

export const MINI_COLLECTION_RULES_VERSION = '1.0.0';

export const MINI_COLLECTIONS = Object.freeze([
  Object.freeze({
    id: 'starforged',
    name: 'Starforged',
    description: 'Born under impossible skies, wearing the House’s galaxy flight colors.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Galaxy Skin + Galaxy Bomber Jacket Outfit',
    all: Object.freeze([
      Object.freeze({ category: 'Skin', anyOf: Object.freeze(['Galaxy']) }),
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Galaxy Bomber Jacket']) }),
    ]),
  }),
  Object.freeze({
    id: 'crownward',
    name: 'Crownward',
    description: 'Royals and Titans who carry the crown in plain sight.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Royal or Titan Class + Crown, Burning Crown, Skull Crown, or Tiara Head',
    all: Object.freeze([
      Object.freeze({ category: 'Class', anyOf: Object.freeze(['Royal', 'Titan']) }),
      Object.freeze({ category: 'Head', anyOf: Object.freeze(['Crown', 'Burning Crown', 'Skull Crown', 'Tiara']) }),
    ]),
  }),
  Object.freeze({
    id: 'arcane-circle',
    name: 'The Arcane Circle',
    description: 'Mystics whose headwear marks them as keepers of forbidden study.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Mystic Class + Wizard Hat, Legacy Wizard Hat, or Skull Candle Head',
    all: Object.freeze([
      Object.freeze({ category: 'Class', anyOf: Object.freeze(['Mystic']) }),
      Object.freeze({ category: 'Head', anyOf: Object.freeze(['Wizard Hat', 'Legacy Wizard Hat', 'Skull Candle']) }),
    ]),
  }),
  Object.freeze({
    id: 'iron-phalanx',
    name: 'The Iron Phalanx',
    description: 'Military ranks armored or uniformed for the Fortress wall.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Military Class + approved armor or officer uniform Outfit',
    all: Object.freeze([
      Object.freeze({ category: 'Class', anyOf: Object.freeze(['Military']) }),
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Spartan Armor', 'Spartan Armor with Cape', 'Heavy Armor', 'Military Officer', 'Officer Uniform', 'Officer Uniform with Cape']) }),
    ]),
  }),
  Object.freeze({
    id: 'night-blades',
    name: 'Night Blades',
    description: 'Eastern battle dress paired with a blade carried at the back.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Ninja, Ronin, Samurai, or Kimono Outfit + Katana or Curved Blade Back',
    all: Object.freeze([
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Ninja Puffer Jacket', 'Ronin Armor', 'Samurai Armor', 'Kimono', 'Fur Kimono', 'Flower Kimono']) }),
      Object.freeze({ category: 'Back', anyOf: Object.freeze(['Katana', 'Curved Blade']) }),
    ]),
  }),
  Object.freeze({
    id: 'dustbound-company',
    name: 'The Dustbound Company',
    description: 'Desert-clad travelers crossing the House’s sun-scoured grounds.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Desert Nomad, Rebel, or Trooper Outfit + Sand, Sandstone, or Yellow Background',
    all: Object.freeze([
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Desert Nomad', 'Desert Rebel', 'Desert Trooper']) }),
      Object.freeze({ category: 'Background', anyOf: Object.freeze(['Sand', 'Sandstone', 'Yellow']) }),
    ]),
  }),
  Object.freeze({
    id: 'skyguard',
    name: 'The Skyguard',
    description: 'Winged Titans equipped for flight, orbit, or the void.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Wings, Dark Wings, or Steel Wings Back + flight or space Outfit',
    all: Object.freeze([
      Object.freeze({ category: 'Back', anyOf: Object.freeze(['Wings', 'Dark Wings', 'Steel Wings']) }),
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Flight Jacket', 'Denim Flight Jacket', 'Astronaut', 'Space Warrior Armor', 'Astro-HOT']) }),
    ]),
  }),
  Object.freeze({
    id: 'gravebound',
    name: 'The Gravebound',
    description: 'Undead and skeletal forms bearing a necromancer’s or reaper’s relic.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Undead or skeletal Skin + necromancy, reaper, or skull weapon Back',
    all: Object.freeze([
      Object.freeze({ category: 'Skin', anyOf: Object.freeze(['Purple Zombie', 'Green Zombie', 'Headless', 'Skinned', 'Translucid Skeleton', 'Cyber Skeleton', 'Skull Ape']) }),
      Object.freeze({ category: 'Back', anyOf: Object.freeze(['Necromancy Staff', 'Reaper Scythe', 'Skull Hammer', 'Skull Wand']) }),
    ]),
  }),
  Object.freeze({
    id: 'violet-circuit',
    name: 'The Violet Circuit',
    description: 'Techwear operatives working against code-lit and violet horizons.',
    ruleVersion: MINI_COLLECTION_RULES_VERSION,
    ruleText: 'Cyberpunk, Techwear, or Syndicate Outfit + Code, Purple, Grape, or Amethyst Background',
    all: Object.freeze([
      Object.freeze({ category: 'Outfit', anyOf: Object.freeze(['Cyberpunk Jacket', 'Cyberpunk Elite Jacket', 'Techwear Coat', 'Titan Techwear Coat', 'Syndicate Coat']) }),
      Object.freeze({ category: 'Background', anyOf: Object.freeze(['Code', 'Purple', 'Grape', 'Amethyst']) }),
    ]),
  }),
]);

export const PLACEHOLDER_VALUES = new Set(['none']);

export const COLLECTION_CHARACTER_RULE = Object.freeze({
  version: '1.0.0',
  maximumHighlights: 4,
  minimumWalletSize: 3,
  mediumWalletSize: 10,
  minimumLift: 1.1,
  minimumOwnedCount: Object.freeze({ small: 2, medium: 3 }),
  tieBreakers: Object.freeze(['lift-desc', 'owned-count-desc', 'collection-count-asc', 'category-asc', 'value-asc']),
});

export const UNEXPECTED_PAIRINGS_RULE = Object.freeze({
  version: '1.0.0',
  maximumHighlights: 3,
  minimumCollectionCount: 2,
  maximumCollectionPercentage: 2,
  minimumLift: 1.25,
  score: 'lift-times-log2-inverse-collection-share',
  tieBreakers: Object.freeze(['score-desc', 'owned-count-desc', 'collection-count-asc', 'left-key-asc', 'right-key-asc']),
});
