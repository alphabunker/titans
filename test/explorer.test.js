import test from 'node:test';
import assert from 'node:assert/strict';
import { explore, traitOptions } from '../src/explorer.js';
import { sampleItems } from '../src/data.js';
test('search, trait selection and favorites intersect', () => {
 const result = explore(sampleItems, { query: '0001', traits: { House: 'Sample A' }, favoritesOnly: true, favorites: ['demo-1'] });
 assert.deepEqual(result.map(item => item.id), ['demo-1']);
 assert.equal(explore(sampleItems, { query: 'not a titan' }).length, 0);
 assert.equal(explore(sampleItems, { traits: { House: 'Sample C' }, favoritesOnly: true, favorites: ['demo-1'] }).length, 0);
});
test('descending sort does not mutate provider records', () => { assert.equal(explore(sampleItems, { sort: 'desc' })[0].number, 24); assert.equal(sampleItems[0].number, 1); });
test('trait options derive from metadata, not fixed UI fields', () => { assert.deepEqual(traitOptions([{ traits: { New: 'B' } }, { traits: { New: 'A' } }]), { New: ['A', 'B'] }); });

test('sample records use collection categories and explicitly fictional values', () => {
 assert.equal(sampleItems[0].traits.House, 'Sample A');
 assert.equal(Object.keys(sampleItems[0].traits).length, 12);
 assert.ok(sampleItems.every(item => Object.values(item.traits).every(value => value.startsWith('Sample '))));
});
