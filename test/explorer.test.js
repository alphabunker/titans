import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionSummary, explore, traitOptions } from '../src/explorer.js';
import { sampleItems } from '../src/data.js';
import { filterTraitCatalog, traitCatalog, traitCategories } from '../src/trait-catalog.js';
test('search, trait selection and favorites intersect', () => {
 const result = explore(sampleItems, { query: '0001', traits: { House: sampleItems[0].traits.House }, favoritesOnly: true, favorites: ['demo-1'] });
 assert.deepEqual(result.map(item => item.id), ['demo-1']);
 assert.equal(explore(sampleItems, { query: 'not a titan' }).length, 0);
 assert.equal(explore(sampleItems, { traits: { House: 'Not a real house' }, favoritesOnly: true, favorites: ['demo-1'] }).length, 0);
});
test('descending sort does not mutate provider records', () => { assert.equal(explore(sampleItems, { sort: 'desc' })[0].number, 24); assert.equal(sampleItems[0].number, 1); });
test('trait options derive from metadata, not fixed UI fields', () => { assert.deepEqual(traitOptions([{ traits: { New: 'B' } }, { traits: { New: 'A' } }]), { New: ['A', 'B'] }); });

test('collection summary reports Titan share and represented classes', () => {
 assert.deepEqual(collectionSummary(sampleItems), { titans: 24, percentage: '0.37%', classes: 6 });
 assert.equal(collectionSummary(Array.from({ length: 35 }, () => ({ traits: { Class: 'Titan' } }))).percentage, '0.54%');
});

test('sample records use verified vocabulary in explicitly synthetic combinations', () => {
 assert.equal(Object.keys(sampleItems[0].traits).length, 12);
 assert.ok(sampleItems.every(item => Object.entries(item.traits).every(([key, value]) => filterTraitCatalog[key].includes(value))));
 assert.ok(sampleItems.every(item => item.sample === true));
});

test('catalog preserves all categories, casing distinctions, and uncomputed trait counts', () => {
 assert.equal(traitCategories.length, 13);
 assert.deepEqual(traitCatalog['Trait Count'], ['2', '4', '5', '6', '7', '8', '9', '10', '11']);
 assert.equal('Trait Count' in filterTraitCatalog, false);
 assert.ok(traitCatalog.Back.includes('None'));
 assert.ok(traitCatalog.Back.includes('NONE'));
 assert.ok(sampleItems.every(item => !('Trait Count' in item.traits)));
});
