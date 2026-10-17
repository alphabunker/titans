import { CONTRACT_VERSION, assertAnalyticsSnapshot, assertCollectionSnapshot } from './contracts.js';
import { FORTRESS_RULES_VERSION, PLACEHOLDER_VALUES, PYRAMID_RULE, RARITY_BANDS } from './fortress-rules.js';
import { normalizeComparisonKey } from './metadata-normalizer.js';

const KEY_SEPARATOR = '\u001f';
const traitKey = trait => `${trait.normalizedCategory}${KEY_SEPARATOR}${trait.normalizedValue}`;
const pairKey = (left, right) => [left, right].sort().join(`${KEY_SEPARATOR}${KEY_SEPARATOR}`);
const PLACEHOLDER_FEATURE_EXCLUSIONS = Object.freeze(['collection-character', 'unexpected-pairings']);

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

export function buildCollectionAnalytics(snapshot, {
  miniCollections = [],
  generatedAt = snapshot.publishedAt,
  rulesVersion = FORTRESS_RULES_VERSION,
} = {}) {
  assertCollectionSnapshot(snapshot, { requireComplete: false });
  miniCollections.forEach(validateMiniCollection);
  if (new Set(miniCollections.map(definition => definition.id)).size !== miniCollections.length) {
    throw new TypeError('Mini-collection ids must be unique');
  }
  const total = snapshot.assets.length;
  const traitFrequencies = {};
  const pairFrequencies = {};
  const byTrait = {};
  const byClass = {};
  const traitsByAsset = [];

  snapshot.assets.forEach((asset, assetIndex) => {
    const traits = uniqueTraits(asset);
    traitsByAsset.push(traits.map(traitKey));
    traits.forEach(trait => {
      const key = traitKey(trait);
      const placeholderLike = PLACEHOLDER_VALUES.has(trait.normalizedValue);
      const frequency = traitFrequencies[key] ??= {
        category: trait.category,
        value: trait.value,
        normalizedCategory: trait.normalizedCategory,
        normalizedValue: trait.normalizedValue,
        placeholderLike,
        featureExclusions: placeholderLike ? [...PLACEHOLDER_FEATURE_EXCLUSIONS] : [],
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
    rulesVersion,
    generatedAt,
    assetCount: total,
    traitFrequencies,
    pairFrequencies,
    rarityBands: Object.fromEntries(RARITY_BANDS.map(band => [band.id, Object.keys(traitFrequencies).filter(key => traitFrequencies[key].rarityBand === band.id)])),
    indexes: {
      assetIds: snapshot.assets.map(asset => asset.assetId),
      traitsByAsset,
      byTrait,
      byClass,
      pyramid: { rule: PYRAMID_RULE, classes: Object.fromEntries(PYRAMID_RULE.tiers.map(tier => [normalizeComparisonKey(tier.classValue), byClass[normalizeComparisonKey(tier.classValue)] ?? []])), titan: byClass.titan ?? [] },
      miniCollections: curated,
    },
  });
}

function intersectionCount(indexes, ownedIndexes) {
  let count = 0;
  for (const index of indexes) if (ownedIndexes.has(index)) count += 1;
  return count;
}

/**
 * Derive owner-specific analytics without a provider or blockchain call.
 * The only visitor-specific input is the list of owned asset IDs.
 */
export function buildOwnerAnalytics(ownedAssetIds, analytics) {
  assertAnalyticsSnapshot(analytics);
  if (!Array.isArray(ownedAssetIds) || ownedAssetIds.some(assetId => typeof assetId !== 'string')) {
    throw new TypeError('ownedAssetIds must be an array of strings');
  }

  const assetIndex = new Map(analytics.indexes.assetIds.map((assetId, index) => [assetId, index]));
  const uniqueOwnedIds = [...new Set(ownedAssetIds)];
  const unknownAssetIds = uniqueOwnedIds.filter(assetId => !assetIndex.has(assetId));
  const ownedIndexes = new Set(uniqueOwnedIds.flatMap(assetId => assetIndex.has(assetId) ? [assetIndex.get(assetId)] : []));
  const traitCounts = Object.fromEntries(Object.entries(analytics.indexes.byTrait)
    .map(([key, indexes]) => [key, intersectionCount(indexes, ownedIndexes)]));

  const pairCounts = {};
  for (const index of ownedIndexes) {
    const pairable = analytics.indexes.traitsByAsset[index]
      .filter(key => !analytics.traitFrequencies[key].placeholderLike);
    for (let leftIndex = 0; leftIndex < pairable.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pairable.length; rightIndex += 1) {
        const left = pairable[leftIndex];
        const right = pairable[rightIndex];
        if (decodeTraitKey(left).normalizedCategory === decodeTraitKey(right).normalizedCategory) continue;
        const key = pairKey(left, right);
        if (analytics.pairFrequencies[key]) pairCounts[key] = (pairCounts[key] ?? 0) + 1;
      }
    }
  }

  const pyramidTiers = analytics.indexes.pyramid.rule.tiers.map(tier => {
    const normalizedClass = normalizeComparisonKey(tier.classValue);
    return { ...tier, owned: intersectionCount(analytics.indexes.pyramid.classes[normalizedClass] ?? [], ownedIndexes) };
  });
  const completed = pyramidTiers.length
    ? Math.min(...pyramidTiers.map(tier => Math.floor(tier.owned / tier.required)))
    : 0;
  const nextTarget = completed + 1;

  return {
    snapshotId: analytics.snapshotId,
    rulesVersion: analytics.rulesVersion,
    ownedCount: ownedIndexes.size,
    ownedIndexes: [...ownedIndexes].sort((left, right) => left - right),
    unknownAssetIds,
    traitCounts,
    pairCounts,
    rarityBands: Object.fromEntries(Object.entries(analytics.rarityBands).map(([band, keys]) => [band, {
      represented: keys.filter(key => traitCounts[key] > 0),
      missing: keys.filter(key => traitCounts[key] === 0),
    }])),
    pyramid: {
      completed,
      titanCount: intersectionCount(analytics.indexes.pyramid.titan, ownedIndexes),
      tiers: pyramidTiers.map(tier => ({ ...tier, missingForNext: Math.max(0, tier.required * nextTarget - tier.owned) })),
    },
    miniCollections: Object.fromEntries(Object.entries(analytics.indexes.miniCollections).map(([id, collection]) => [id, {
      owned: intersectionCount(collection.matches, ownedIndexes),
      total: collection.matches.length,
    }])),
  };
}

/** Verify a serialized analytics artifact against its canonical snapshot. */
export function assertAnalyticsReconciles(snapshot, analytics) {
  assertCollectionSnapshot(snapshot, { requireComplete: false });
  assertAnalyticsSnapshot(analytics);
  if (analytics.snapshotId !== snapshot.snapshotId) throw new TypeError('Analytics snapshotId does not match the canonical snapshot');
  if (analytics.assetCount !== snapshot.assets.length) throw new TypeError('Analytics assetCount does not match the canonical snapshot');
  const miniCollections = Object.entries(analytics.indexes.miniCollections).map(([id, collection]) => ({
    id,
    name: collection.name,
    description: collection.description,
    ruleVersion: collection.ruleVersion,
    all: collection.all,
  }));
  const rebuilt = buildCollectionAnalytics(snapshot, {
    miniCollections,
    generatedAt: analytics.generatedAt,
    rulesVersion: analytics.rulesVersion,
  });
  if (JSON.stringify(rebuilt) !== JSON.stringify(analytics)) {
    throw new TypeError('Analytics indexes do not reconcile to the canonical snapshot');
  }
  return analytics;
}

export function decodeTraitKey(key) {
  const [category, value] = key.split(KEY_SEPARATOR);
  return { normalizedCategory: category, normalizedValue: value };
}
