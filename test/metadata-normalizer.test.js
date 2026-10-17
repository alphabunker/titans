import test from 'node:test';
import assert from 'node:assert/strict';
import { CIP68_REFERENCE_LABEL_PREFIX, CIP68_USER_LABEL_PREFIX, COLLECTION_POLICY_ID } from '../src/contracts.js';
import { decodeAssetName, extractIpfsCid, normalizeCip68Asset, normalizeComparisonKey } from '../src/metadata-normalizer.js';

const rawAssetName = 'HouseOfTitans0597';
const rawAssetNameHex = `${CIP68_USER_LABEL_PREFIX}${Buffer.from(rawAssetName).toString('hex')}`;
const evidence = {
  assetId: `${COLLECTION_POLICY_ID}${rawAssetNameHex}`,
  referenceAssetId: `${COLLECTION_POLICY_ID}${CIP68_REFERENCE_LABEL_PREFIX}${Buffer.from(rawAssetName).toString('hex')}`,
  rawAssetNameHex,
  cip68Label: 222,
  metadata: {
    name: 'Joralon Vaerion',
    image: 'ipfs://bafy-example/image.png',
    number: '597',
    attributes: { Class: 'Royal', Back: 'None', Special: 'NONE' },
  },
  metadataHash: `sha256:${'a'.repeat(64)}`,
  provider: 'koios',
  retrievedAt: '2026-10-17T18:00:00.000Z',
  blockHeight: 123,
  blockTime: '2026-10-17T17:59:00.000Z',
};

test('asset name decoding accepts printable UTF-8 and rejects invalid bytes', () => {
  assert.equal(decodeAssetName(rawAssetNameHex), rawAssetName);
  assert.equal(decodeAssetName('ff'), null);
  assert.equal(decodeAssetName('abc'), null);
});

test('IPFS identity is extracted without losing the original URI', () => {
  assert.equal(extractIpfsCid('ipfs://bafy-example/image.png'), 'bafy-example');
  assert.equal(extractIpfsCid('ipfs://ipfs/bafy-example'), 'bafy-example');
  assert.equal(extractIpfsCid('https://example.com/image.png'), null);
});

test('normalization preserves source casing while adding comparison keys', () => {
  const result = normalizeCip68Asset(evidence);
  assert.equal(result.displayName, 'Joralon Vaerion');
  assert.equal(result.number, 597);
  assert.equal(result.numberSource, 'metadata');
  assert.equal(result.imageUri, evidence.metadata.image);
  assert.equal(result.imageCid, 'bafy-example');
  assert.deepEqual(result.traits.map(({ category, value }) => [category, value]), [
    ['Class', 'Royal'], ['Back', 'None'], ['Special', 'NONE'],
  ]);
  assert.equal(result.traits[1].normalizedValue, 'none');
  assert.equal(result.traits[2].normalizedValue, 'none');
});

test('normalization does not invent absent display metadata', () => {
  const minimal = normalizeCip68Asset({
    ...evidence,
    rawAssetNameHex: `${CIP68_USER_LABEL_PREFIX}${Buffer.from('UnnumberedTitan').toString('hex')}`,
    assetId: `${COLLECTION_POLICY_ID}${CIP68_USER_LABEL_PREFIX}${Buffer.from('UnnumberedTitan').toString('hex')}`,
    referenceAssetId: null,
    metadata: {},
  });
  assert.equal(minimal.displayName, null);
  assert.equal(minimal.number, null);
  assert.equal(minimal.numberSource, null);
  assert.equal(minimal.imageUri, null);
  assert.deepEqual(minimal.traits, []);
});

test('top-level CIP-68 trait fields are accepted when no attributes map exists', () => {
  const result = normalizeCip68Asset({ ...evidence, metadata: { name: 'Titan', image: 'ipfs://cid', Class: 'Titan', House: 'House Of Fire' } });
  assert.deepEqual(result.traits.map(({ category, value }) => [category, value]), [['Class', 'Titan'], ['House', 'House Of Fire']]);
});

test('comparison keys normalize Unicode, whitespace, and case without replacing source values', () => {
  assert.equal(normalizeComparisonKey('  ROYAL  '), 'royal');
  assert.equal(normalizeComparisonKey('Ｒｏｙａｌ'), 'royal');
});
