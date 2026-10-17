export const FORTRESS_RULES_VERSION = '1.1.0';

export const PYRAMID_RULE = Object.freeze({
  version: '1.0.0',
  tiers: Object.freeze([
    Object.freeze({ classValue: 'Royal', required: 1 }),
    Object.freeze({ classValue: 'Mystic', required: 2 }),
    Object.freeze({ classValue: 'Military', required: 3 }),
    Object.freeze({ classValue: 'Townsfolk', required: 4 }),
    Object.freeze({ classValue: 'Peasant', required: 5 }),
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

export const PLACEHOLDER_VALUES = new Set(['none']);
