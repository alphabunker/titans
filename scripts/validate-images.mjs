import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchValidatedImage, normalizeGatewayHost, resolveIpfsImageUrl } from '../src/media.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const input = resolve(argument('--input', '.data/full-bootstrap-story8/collection.candidate.json'));
const sampleSize = Number(argument('--sample-size', '3'));
const gatewayHost = normalizeGatewayHost(argument('--gateway-host', process.env.PINATA_GATEWAY_HOST || 'gateway.pinata.cloud'));
if (!Number.isSafeInteger(sampleSize) || sampleSize < 1) throw new TypeError('--sample-size must be a positive integer');
const snapshot = JSON.parse(await readFile(input, 'utf8'));
const candidates = snapshot.assets.filter(asset => asset.imageUri && asset.imageCid).slice(0, sampleSize);
if (candidates.length !== sampleSize) throw new TypeError(`Expected ${sampleSize} image-bearing assets and found ${candidates.length}`);

const results = [];
for (const asset of candidates) {
  const identity = resolveIpfsImageUrl(asset, { gatewayHost });
  const media = await fetchValidatedImage(identity.url);
  results.push({ number: asset.number, name: asset.displayName, cid: identity.cid, contentType: media.contentType, bytes: media.bytes });
}
process.stdout.write(`${JSON.stringify({ gatewayHost, sampleSize, results }, null, 2)}\n`);
