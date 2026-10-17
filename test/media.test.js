import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchValidatedImage, normalizeGatewayHost, parseIpfsIdentity, resolveIpfsImageUrl } from '../src/media.js';

const cid = 'QmeiC8Hyv8juMEVK5gZHZVcw9VomyLgNGeBh2U6iPLk1eh';

test('IPFS resolution preserves canonical identity and replaces only the gateway host', () => {
  const asset = { imageUri: `ipfs://${cid}/portraits/Titan One.jpg`, imageCid: cid };
  const first = resolveIpfsImageUrl(asset, { gatewayHost: 'gateway.pinata.cloud' });
  const second = resolveIpfsImageUrl(asset, { gatewayHost: 'https://titans.mypinata.cloud' });
  assert.equal(first.imageUri, asset.imageUri);
  assert.equal(first.cid, cid);
  assert.equal(first.url, `https://gateway.pinata.cloud/ipfs/${cid}/portraits/Titan%20One.jpg`);
  assert.equal(second.url, `https://titans.mypinata.cloud/ipfs/${cid}/portraits/Titan%20One.jpg`);
});

test('gateway configuration rejects credentials, tokens, paths, and insecure protocols', () => {
  assert.equal(normalizeGatewayHost('gateway.pinata.cloud'), 'gateway.pinata.cloud');
  for (const value of [
    'http://gateway.pinata.cloud',
    'https://user:secret@gateway.pinata.cloud',
    'https://gateway.pinata.cloud/ipfs',
    'https://gateway.pinata.cloud?pinataGatewayToken=secret',
  ]) assert.throws(() => normalizeGatewayHost(value), /HTTPS host/);
});

test('IPFS identity rejects absent or unsafe CIDs', () => {
  assert.throws(() => parseIpfsIdentity(null, null), /valid IPFS CID/);
  assert.throws(() => parseIpfsIdentity('ipfs://../../script'), /valid IPFS CID/);
});

test('validated image fetch accepts bounded raster image responses', async () => {
  const body = new Blob(['image-bytes'], { type: 'image/jpeg' });
  const fetchImpl = async () => new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(body.size) } });
  const result = await fetchValidatedImage('https://gateway.example/ipfs/cid', { fetchImpl });
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.bytes, body.size);
});

test('validated image fetch rejects non-images, oversized media, and HTTP failures', async () => {
  await assert.rejects(() => fetchValidatedImage('https://gateway.example/ipfs/cid', {
    fetchImpl: async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  }), /MIME/);
  await assert.rejects(() => fetchValidatedImage('https://gateway.example/ipfs/cid', {
    maxBytes: 3,
    fetchImpl: async () => new Response('large', { status: 200, headers: { 'content-type': 'image/png', 'content-length': '5' } }),
  }), /byte limit/);
  await assert.rejects(() => fetchValidatedImage('https://gateway.example/ipfs/cid', {
    fetchImpl: async () => new Response('', { status: 404 }),
  }), /HTTP 404/);
});

test('validated image fetch aborts a slow gateway request', async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(() => fetchValidatedImage('https://gateway.example/ipfs/cid', { fetchImpl, timeoutMs: 5 }), /timed out/);
});
