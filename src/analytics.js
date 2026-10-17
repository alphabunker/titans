import { CONTRACT_VERSION, assertAnalyticsSnapshot, assertCollectionSnapshot } from './contracts.js';
import { FORTRESS_RULES_VERSION, PLACEHOLDER_VALUES, PYRAMID_RULE, RARITY_BANDS } from './fortress-rules.js';
import { normalizeComparisonKey } from './metadata-normalizer.js';

const KEY_SEPARATOR = '\u001f';
const traitKey = trait => `${trait.normalizedCategory}${KEY_SEPARATOR}${trait.normalizedValue}`;
const pairKey = (left, right) => [left, right].sort().join(`${KEY_SEPARATOR}${KEY_SEPARATOR}`);

const percentage = (count, total) => total ? Number(((count / total) * 100).toFixed(6)) : 0;

export function rarityBandFor(percentageValue) {
  return RARITY_BANDS.find(band => percentageValue >= band.minimum && percentageValue < band.maximumExclusive)?.id ?? 'common';
}

function addIndex(index, key, assetIndex) {
  (index[key] ??= []).push(assetIndex);
}

function uniqueTraits(asset) {
  const seen = new Set();
  return asset.traits.filter(trait => {
    const key = traitKey(trait);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateMiniCollection(definition) {
  if (!definition || typeof definition.id !== 'string' || !definition.id || typeof definition.name !== 'string' || !definition.name) {
    throw new TypeError('Mini-collection definitions require an id and name');
  }
  if (!Array.isArray(definition.all) || !definition.all.length) throw new TypeError(`Mini-collection ${definition.id} requires at least one condition`);
  definition.all.forEach(condition => {
    if (!condition || typeof condition.category !== 'string' || typeof condition.value !== 'string') {
      throw new TypeError(`Mini-collection ${definition.id} has an invalid condition`);
    }
  });
}

function miniCollectionMatches(asset, definition) {
  const keys = new Set(asset.traits.map(traitKey));
  return definition.all.every(condition => keys.has(`${normalizeComparisonKey(condition.category)}${KEY_SEPARATOR}${normalizeComparisonKey(condition.value)}`));
}

export function buildCollectionAnalytics(snapshot, { miniCollections = [], generatedAt = new Date().toISOString() } = {}) {
  assertCollectionSnapshot(snapshot, { requireComplete: false });
  miniCollections.forEach(validateMiniCollection);
  const total = snapshot.assets.length;
  const traitFrequencies = {};
  const pairFrequencies = {};
  const byTrait = {};
  const byClass = {};

  snapshot.assets.forEach((asset, assetIndex) => {
    const traits = uniqueTraits(asset);
    traits.forEach(trait => {
      const key = traitKey(trait);
      const frequency = traitFrequencies[key] ??= {
        category: trait.category,
        value: trait.value,
        normalizedCategory: trait.normalizedCategory,
        normalizedValue: trait.normalizedValue,
        count: 0,
        percentage: 0,
        rarityBand: null,
      };
      frequency.count += 1;
      addIndex(byTrait, key, assetIndex);
      if (trait.normalizedCategory === 'class') addIndex(byClass, trait.normalizedValue, assetIndex);
    });
    const pairable = traits.filter(trait => !PLACEHOLDER_VALUES.has(trait.normalizedValue));
    for (let leftIndex = 0; leftIndex < pairable.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pairable.length; rightIndex += 1) {
        const left = pairable[leftIndex];
        const right = pairable[rightIndex];
        if (left.normalizedCategory === right.normalizedCategory) continue;
        const leftKey = traitKey(left);
        const rightKey = traitKey(right);
        const key = pairKey(leftKey, rightKey);
        const pair = pairFrequencies[key] ??= { left: leftKey, right: rightKey, count: 0 };
        pair.count += 1;
      }
    }
  });

  for (const frequency of Object.values(traitFrequencies)) {
    frequency.percentage = percentage(frequency.count, total);
    frequency.rarityBand = rarityBandFor(frequency.percentage);
  }

  const curated = Object.fromEntries(miniCollections.map(definition => {
    const matches = [];
    snapshot.assets.forEach((asset, index) => { if (miniCollectionMatches(asset, definition)) matches.push(index); });
    return [definition.id, {
      name: definition.name,
      description: definition.description ?? '',
      ruleVersion: definition.ruleVersion ?? FORTRESS_RULES_VERSION,
      all: definition.all,
      matches,
    }];
  }));

  return assertAnalyticsSnapshot({
    contractVersion: CONTRACT_VERSION,
    snapshotId: snapshot.snapshotId,
    rulesVersion: FORTRESS_RULES_VERSION,
    generatedAt,
    assetCount: total,
    traitFrequencies,
    pairFrequencies,
    rarityBands: Object.fromEntries(RARITY_BANDS.map(band => [band.id, Object.keys(traitFrequencies).filter(key => traitFrequencies[key].rarityBand === band.id)])),
    indexes: {
      byTrait,
      byClass,
      pyramid: { rule: PYRAMID_RULE, classes: Object.fromEntries(PYRAMID_RULE.tiers.map(tier => [normalizeComparisonKey(tier.classValue), byClass[normalizeComparisonKey(tier.classValue)] ?? []])), titan: byClass.titan ?? [] },
      miniCollections: curated,
    },
  });
}

export function decodeTraitKey(key) {
  const [category, value] = key.split(KEY_SEPARATOR);
  return { normalizedCategory: category, normalizedValue: value };
}

