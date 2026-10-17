import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAnalyticsReconciles, buildCollectionAnalytics, buildOwnerAnalytics, decodeTraitKey, rarityBandFor } from '../src/analytics.js';
import { CIP68_USER_LABEL_PREFIX, COLLECTION_POLICY_ID, CONTRACT_VERSION } from '../src/contracts.js';

const makeAsset = (number, traits) => {
  const payload = Buffer.from(`HouseOfTitans${String(number).padStart(4, '0')}`).toString('hex');
  const rawAssetNameHex = `${CIP68_USER_LABEL_PREFIX}${payload}`;
  return {
    contractVersion: CONTRACT_VERSION, policyId: COLLECTION_POLICY_ID,
    assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`, referenceAssetId: null,
    rawAssetNameHex, rawAssetName: `HouseOfTitans${String(number).padStart(4, '0')}`,
    displayName: `Titan ${number}`, number, numberSource: 'asset-name', metadataStandard: 'CIP-68', cip68Label: 222,
    imageUri: null, imageCid: null,
    traits: Object.entries(traits).map(([category, value]) => ({ category, value, normalizedCategory: category.toLowerCase(), normalizedValue: value.toLowerCase() })),
    metadataHash: `sha256:${number.toString(16).padStart(64, '0')}`, normalizationVersion: '1.0.0',
    source: { provider: 'koios', retrievedAt: '2026-10-17T18:00:00.000Z', blockHeight: null, blockTime: null },
  };
};
const assets = [
  makeAsset(1, { Class: 'Royal', Skin: 'Human', Eyes: 'NONE' }),
  makeAsset(2, { Class: 'Mystic', Skin: 'Human', Eyes: 'Blue' }),
  makeAsset(3, { Class: 'Titan', Skin: 'Alien', Eyes: 'Blue' }),
  makeAsset(4, { Class: 'Military', Skin: 'Human', Eyes: 'NONE' }),
];
const snapshot = { contractVersion: CONTRACT_VERSION, snapshotId: 'snapshot-1', publishedAt: '2026-10-17T18:00:00.000Z', policyId: COLLECTION_POLICY_ID, expectedCount: 6500, assets };

test('analytics computes trait counts, percentages, rarity bands, and indexes', () => {
  const analytics = buildCollectionAnalytics(snapshot, { generatedAt: '2026-10-17T18:01:00.000Z' });
  const humanKey = Object.keys(analytics.traitFrequencies).find(key => decodeTraitKey(key).normalizedValue === 'human');
  assert.equal(analytics.traitFrequencies[humanKey].count, 3);
  assert.equal(analytics.traitFrequencies[humanKey].percentage, 75);
  assert.equal(analytics.traitFrequencies[humanKey].rarityBand, 'common');
  assert.deepEqual(analytics.indexes.byTrait[humanKey], [0, 1, 3]);
  assert.deepEqual(analytics.indexes.pyramid.titan, [2]);
  assert.deepEqual(analytics.indexes.pyramid.classes.royal, [0]);
});

test('pair counts exclude placeholder values and same-category combinations', () => {
  const analytics = buildCollectionAnalytics(snapshot, { generatedAt: '2026-10-17T18:01:00.000Z' });
  const pairs = Object.values(analytics.pairFrequencies);
  assert.ok(pairs.every(pair => !pair.left.endsWith('\u001fnone') && !pair.right.endsWith('\u001fnone')));
  const noneFrequency = Object.values(analytics.traitFrequencies).find(frequency => frequency.normalizedValue === 'none');
  assert.equal(noneFrequency.placeholderLike, true);
  assert.deepEqual(noneFrequency.featureExclusions, ['collection-character', 'unexpected-pairings']);
  const humanBlue = pairs.find(pair => pair.left.includes('human') && pair.right.includes('blue') || pair.left.includes('blue') && pair.right.includes('human'));
  assert.equal(humanBlue.count, 1);
});

test('rarity band thresholds follow the approved initial boundaries', () => {
  assert.equal(rarityBandFor(0.999), 'legendary');
  assert.equal(rarityBandFor(1), 'epic');
  assert.equal(rarityBandFor(3), 'rare');
  assert.equal(rarityBandFor(6), 'uncommon');
  assert.equal(rarityBandFor(15), 'common');
});

test('rare details reconcile frequencies, owner states, representatives, and placeholder exclusions', () => {
  const analytics = buildCollectionAnalytics(snapshot);
  const owner = buildOwnerAnalytics([assets[0].assetId, assets[2].assetId], analytics);
  const details = Object.values(owner.rareDetails.bands).flatMap(band => band.details);
  const nonPlaceholderKeys = Object.entries(analytics.traitFrequencies).filter(([, frequency]) => !frequency.placeholderLike).map(([key]) => key);
  assert.equal(owner.rareDetails.ruleVersion, '1.0.0');
  assert.equal(owner.rareDetails.excludedPlaceholderCount, 1);
  assert.equal(details.length, nonPlaceholderKeys.length);
  assert.ok(details.every(detail => detail.collectionCount === detail.matchingCollectionIndexes.length));
  assert.ok(details.every(detail => detail.ownedCount === detail.matchingOwnedIndexes.length));
  assert.ok(details.every(detail => detail.representativeIndex === (detail.matchingOwnedIndexes[0] ?? detail.matchingCollectionIndexes[0])));
  assert.ok(details.every(detail => !detail.value.toLowerCase().includes('none')));
  const human = details.find(detail => detail.value === 'Human');
  assert.equal(human.owned, true);
  assert.equal(human.ownedCount, 1);
  const alien = details.find(detail => detail.value === 'Alien');
  assert.equal(alien.owned, true);
  assert.equal(alien.ownedCount, 1);
  assert.equal(Object.values(owner.rareDetails.bands).every(band => band.representedCount + band.missingCount === band.details.length), true);
});

test('versioned mini-collection membership is deterministic from canonical traits', () => {
  const analytics = buildCollectionAnalytics(snapshot, {
    generatedAt: '2026-10-17T18:01:00.000Z',
    miniCollections: [{ id: 'royal-humans', name: 'Royal Humans', ruleVersion: 'draft-1', all: [{ category: 'Class', value: 'Royal' }, { category: 'Skin', value: 'Human' }] }],
  });
  assert.deepEqual(analytics.indexes.miniCollections['royal-humans'].matches, [0]);
  assert.equal(analytics.indexes.miniCollections['royal-humans'].ruleVersion, 'draft-1');
});

test('analytics are byte-deterministic for the same snapshot and rule versions', () => {
  const options = {
    rulesVersion: 'fortress-1',
    miniCollections: [{ id: 'royal-humans', name: 'Royal Humans', ruleVersion: 'draft-1', all: [{ category: 'Class', value: 'Royal' }, { category: 'Skin', value: 'Human' }] }],
  };
  assert.equal(JSON.stringify(buildCollectionAnalytics(snapshot, options)), JSON.stringify(buildCollectionAnalytics(snapshot, options)));
  assert.notEqual(
    JSON.stringify(buildCollectionAnalytics(snapshot, options)),
    JSON.stringify(buildCollectionAnalytics(snapshot, { ...options, rulesVersion: 'fortress-2' })),
  );
});

test('owner analytics need only owned asset IDs and the published indexes', () => {
  const analytics = buildCollectionAnalytics(snapshot, {
    miniCollections: [{ id: 'royal-humans', name: 'Royal Humans', ruleVersion: 'draft-1', all: [{ category: 'Class', value: 'Royal' }, { category: 'Skin', value: 'Human' }] }],
  });
  const owner = buildOwnerAnalytics([assets[0].assetId, assets[2].assetId, assets[2].assetId, 'unknown'], analytics);
  const humanKey = Object.keys(analytics.traitFrequencies).find(key => decodeTraitKey(key).normalizedValue === 'human');
  assert.equal(owner.ownedCount, 2);
  assert.deepEqual(owner.unknownAssetIds, ['unknown']);
  assert.deepEqual(owner.summary, {
    titans: 2,
    collectionPercentage: 0.03,
    classesRepresented: 2,
    classValues: ['royal', 'titan'],
    denominator: 6500,
    percentagePrecision: 2,
  });
  assert.equal(owner.character.lowEvidence, true);
  assert.deepEqual(owner.character.highlights, []);
  assert.equal(owner.pairings.ruleVersion, '1.0.0');
  assert.equal(owner.traitCounts[humanKey], 1);
  assert.equal(owner.pyramid.titanCount, 1);
  assert.equal(owner.pyramid.completed, 0);
  assert.deepEqual(owner.miniCollections['royal-humans'], { owned: 1, total: 1 });
  assert.ok(Object.keys(owner.pairCounts).every(key => !key.endsWith('\u001fnone')));
});

test('unexpected pairings rank deterministically and reconcile complete and owned subsets', () => {
  const pairAssets = [
    makeAsset(11, { Class: 'Royal', Skin: 'Human', Eyes: 'Blue' }),
    makeAsset(12, { Class: 'Royal', Skin: 'Human', Eyes: 'Blue' }),
    makeAsset(13, { Class: 'Royal', Skin: 'Human', Eyes: 'Green' }),
    makeAsset(14, { Class: 'Mystic', Skin: 'Alien', Eyes: 'Blue' }),
    makeAsset(15, { Class: 'Mystic', Skin: 'Alien', Eyes: 'Blue' }),
    makeAsset(16, { Class: 'Mystic', Skin: 'Alien', Eyes: 'Green' }),
  ];
  const fillers = Array.from({ length: 94 }, (_, index) => makeAsset(100 + index, {
    Class: `Filler ${index}`,
    Skin: `Stone ${index}`,
    Eyes: `Ash ${index}`,
  }));
  const pairSnapshot = { ...snapshot, assets: [...pairAssets, ...fillers] };
  const analytics = buildCollectionAnalytics(pairSnapshot);
  const owner = buildOwnerAnalytics([pairAssets[0].assetId, pairAssets[1].assetId, pairAssets[3].assetId], analytics);
  assert.equal(owner.pairings.ruleVersion, '1.0.0');
  assert.equal(owner.pairings.minimumCollectionCount, 2);
  assert.equal(owner.pairings.maximumCollectionPercentage, 2);
  const first = owner.pairings.highlights[0];
  assert.deepEqual([first.left.category, first.left.value, first.right.category, first.right.value], ['Class', 'Royal', 'Eyes', 'Blue']);
  assert.equal(first.ownedCount, 2);
  assert.equal(first.collectionCount, 2);
  assert.equal(first.representativeIndex, 0);
  assert.deepEqual(first.matchingOwnedIndexes, [0, 1]);
  assert.deepEqual(first.matchingCollectionIndexes, [0, 1]);
  assert.ok(first.lift >= 1.25);
  assert.deepEqual(owner.pairings.highlights.slice(0, 2).map(highlight => [highlight.left.value, highlight.right.value]), [
    ['Royal', 'Blue'],
    ['Blue', 'Human'],
  ]);
  assert.ok(owner.pairings.highlights.every(highlight => highlight.collectionCount >= 2));
  assert.ok(owner.pairings.highlights.every(highlight => highlight.matchingCollectionIndexes.length === highlight.collectionCount));
  assert.ok(owner.pairings.highlights.every(highlight => highlight.matchingOwnedIndexes.length === highlight.ownedCount));
});

test('collection character applies minimum evidence, lift, representative, and deterministic ranking rules', () => {
  const analytics = buildCollectionAnalytics(snapshot);
  const owner = buildOwnerAnalytics([assets[0].assetId, assets[1].assetId, assets[3].assetId], analytics);
  assert.equal(owner.summary.titans, 3);
  assert.equal(owner.summary.collectionPercentage, 0.05);
  assert.equal(owner.summary.classesRepresented, 3);
  assert.equal(owner.character.ruleVersion, '1.0.0');
  assert.equal(owner.character.lowEvidence, false);
  assert.equal(owner.character.minimumOwnedCount, 2);
  assert.deepEqual(owner.character.highlights.map(highlight => highlight.value), ['Human']);
  assert.equal(owner.character.highlights[0].ownedCount, 3);
  assert.equal(owner.character.highlights[0].collectionCount, 3);
  assert.equal(owner.character.highlights[0].lift, 1.3333);
  assert.equal(owner.character.highlights[0].representativeIndex, 0);
  assert.deepEqual(owner.character.highlights[0].matchingOwnedIndexes, [0, 1, 3]);
});

test('pyramid reports exact zero, partial, complete, and multiple-complete progress while excluding Titans', () => {
  const classCounts = { Royal: 3, Mystic: 6, Military: 9, Townsfolk: 12, Peasant: 15, Titan: 3 };
  let number = 300;
  const classAssets = Object.entries(classCounts).flatMap(([classValue, count]) => Array.from({ length: count }, () => makeAsset(number++, { Class: classValue })));
  const classSnapshot = { ...snapshot, assets: classAssets };
  const analytics = buildCollectionAnalytics(classSnapshot);
  const ids = classValue => classAssets.filter(asset => asset.traits[0].value === classValue).map(asset => asset.assetId);
  const choose = counts => Object.entries(counts).flatMap(([classValue, count]) => ids(classValue).slice(0, count));

  const zero = buildOwnerAnalytics([], analytics).pyramid;
  assert.equal(zero.completed, 0);
  assert.equal(zero.nextTarget, 1);
  assert.equal(zero.totalMissingForNext, 15);
  assert.deepEqual(zero.tiers.map(tier => tier.missingForNext), [1, 2, 3, 4, 5]);
  assert.equal(zero.titanCount, 0);

  const partial = buildOwnerAnalytics(choose({ Royal: 1, Mystic: 1, Military: 3, Townsfolk: 2, Peasant: 4, Titan: 2 }), analytics).pyramid;
  assert.equal(partial.completed, 0);
  assert.equal(partial.totalMissingForNext, 4);
  assert.deepEqual(partial.tiers.map(tier => tier.missingForNext), [0, 1, 0, 2, 1]);
  assert.equal(partial.titanCount, 2);
  assert.equal(partial.tiers[0].matchingOwnedIndexes.length, 1);
  assert.equal(partial.tiers[0].matchingCollectionIndexes.length, 3);
  assert.equal(partial.titanOwnedIndexes.length, 2);
  assert.equal(partial.titanCollectionIndexes.length, 3);

  const one = buildOwnerAnalytics(choose({ Royal: 1, Mystic: 2, Military: 3, Townsfolk: 4, Peasant: 5, Titan: 3 }), analytics).pyramid;
  assert.equal(one.completed, 1);
  assert.equal(one.nextTarget, 2);
  assert.equal(one.totalMissingForNext, 15);
  assert.equal(one.titanCount, 3);

  const multiple = buildOwnerAnalytics(choose({ Royal: 3, Mystic: 4, Military: 7, Townsfolk: 8, Peasant: 10, Titan: 3 }), analytics).pyramid;
  assert.equal(multiple.completed, 2);
  assert.equal(multiple.nextTarget, 3);
  assert.deepEqual(multiple.tiers.map(tier => tier.missingForNext), [0, 2, 2, 4, 5]);
  assert.equal(multiple.totalMissingForNext, 13);
  assert.equal(multiple.titanCount, 3);
  assert.equal(multiple.requiredPerPyramid, 15);
  assert.equal(multiple.ruleVersion, '1.0.0');
  assert.equal(analytics.indexes.pyramid.rule.enhancedVersion, null);
});

test('serialized indexes reconcile to canonical assets and reject drift', () => {
  const analytics = buildCollectionAnalytics(snapshot);
  assert.equal(assertAnalyticsReconciles(snapshot, analytics), analytics);
  const key = Object.keys(analytics.traitFrequencies)[0];
  const drifted = structuredClone(analytics);
  drifted.traitFrequencies[key].count += 1;
  assert.throws(() => assertAnalyticsReconciles(snapshot, drifted), /count|reconcile/);
});
