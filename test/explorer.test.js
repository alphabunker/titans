import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionSummary, explore, traitOptionCounts, traitOptions } from '../src/explorer.js';
import { filterTraitCatalog, traitCatalog, traitCategories } from '../src/trait-catalog.js';

const items = [
 { id: 'one', number: 1, name: 'Edward North', traits: { House: 'House Of War', Class: 'Military' } },
 { id: 'two', number: 2, name: 'Gotthard', traits: { House: 'House Of Magic', Class: 'Mystic' } },
 { id: 'three', number: 3, name: 'Prince Grymokar', traits: { House: 'House Of War', Class: 'Royal' } },
];
test('search, trait selection and favorites intersect', () => {
 const result = explore(items, { query: '1', traits: { House: items[0].traits.House }, favoritesOnly: true, favorites: ['one'] });
 assert.deepEqual(result.map(item => item.id), ['one']);
 assert.equal(explore(items, { query: 'not a titan' }).length, 0);
 assert.equal(explore(items, { traits: { House: 'Not a real house' }, favoritesOnly: true, favorites: ['one'] }).length, 0);
});
test('descending sort does not mutate provider records', () => { assert.equal(explore(items, { sort: 'desc' })[0].number, 3); assert.equal(items[0].number, 1); });
test('trait options derive from metadata, not fixed UI fields', () => { assert.deepEqual(traitOptions([{ traits: { New: 'B' } }, { traits: { New: 'A' } }]), { New: ['A', 'B'] }); });
test('trait option counts reconcile to loaded metadata', () => {
 assert.deepEqual(traitOptionCounts(items), {
  House: { 'House Of Magic': 1, 'House Of War': 2 },
  Class: { Military: 1, Mystic: 1, Royal: 1 },
 });
});

test('collection summary reports Titan share and represented classes', () => {
 assert.deepEqual(collectionSummary(items), { titans: 3, percentage: '0.05%', classes: 3 });
 assert.equal(collectionSummary(Array.from({ length: 35 }, () => ({ traits: { Class: 'Titan' } }))).percentage, '0.54%');
});

test('catalog preserves all categories, casing distinctions, and uncomputed trait counts', () => {
 assert.equal(traitCategories.length, 13);
 assert.deepEqual(traitCatalog['Trait Count'], ['2', '4', '5', '6', '7', '8', '9', '10', '11']);
 assert.equal('Trait Count' in filterTraitCatalog, false);
 assert.ok(traitCatalog.Back.includes('None'));
 assert.ok(traitCatalog.Back.includes('NONE'));
});
