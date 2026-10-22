import test from 'node:test';
import assert from 'node:assert/strict';
import { CIP67_LABEL_PREFIXES, decodeAssetName, decodeCip68Metadata, decodePlutusData, parseCip67Label } from '../src/metadata-normalizer.js';

const payloadHex = Buffer.from('HouseOfTitans0597').toString('hex');

test('CIP-67 labels are identified and removed only for human-readable decoding', () => {
  const userName = `${CIP67_LABEL_PREFIXES[222]}${payloadHex}`;
  assert.deepEqual(parseCip67Label(userName), { label: 222, payloadHex });
  assert.equal(decodeAssetName(userName), 'HouseOfTitans0597');
  assert.deepEqual(parseCip67Label(payloadHex), { label: null, payloadHex });
});

test('Plutus datum maps decode bytes, integers, lists, and constructors', () => {
  const datum = {
    constructor: 0,
    fields: [{ map: [
      { k: { bytes: Buffer.from('name').toString('hex') }, v: { bytes: Buffer.from('Joralon Vaerion').toString('hex') } },
      { k: { bytes: Buffer.from('number').toString('hex') }, v: { int: 597 } },
      { k: { bytes: Buffer.from('traits').toString('hex') }, v: { map: [
        { k: { bytes: Buffer.from('Class').toString('hex') }, v: { bytes: Buffer.from('Royal').toString('hex') } },
      ] } },
    ] }],
  };
  assert.deepEqual(decodePlutusData(datum), { name: 'Joralon Vaerion', number: 597, traits: { Class: 'Royal' } });
  assert.deepEqual(decodeCip68Metadata({ 222: datum }), { name: 'Joralon Vaerion', number: 597, traits: { Class: 'Royal' } });
});

test('CIP-68 decoder unwraps the metadata-map and version constructor fields used live', () => {
  const liveShape = { 222: { constructor: 0, fields: [
    { map: [{ k: { bytes: Buffer.from('name').toString('hex') }, v: { bytes: Buffer.from('Edward North').toString('hex') } }] },
    { int: 1 },
  ] } };
  assert.deepEqual(decodeCip68Metadata(liveShape), { name: 'Edward North' });
});

test('CIP-68 decoder rejects absent labels and preserves undecodable bytes as hex', () => {
  assert.equal(decodeCip68Metadata({ 100: {} }), null);
  assert.equal(decodePlutusData({ bytes: 'ff' }), '0xff');
});
