import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertAnalyticsReconciles, buildOwnerAnalytics } from '../src/analytics.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const snapshotPath = resolve(argument('--snapshot', '.data/full-bootstrap-ordered/collection.candidate.json'));
const analyticsPath = resolve(argument('--analytics', '.data/full-bootstrap-ordered/analytics.json'));
const iterations = Number(argument('--iterations', '200'));
if (!Number.isSafeInteger(iterations) || iterations < 1) throw new TypeError('--iterations must be a positive integer');

const [snapshotBody, analyticsBody] = await Promise.all([
  readFile(snapshotPath, 'utf8'),
  readFile(analyticsPath, 'utf8'),
]);
const snapshot = JSON.parse(snapshotBody);
const analytics = JSON.parse(analyticsBody);
assertAnalyticsReconciles(snapshot, analytics);

const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
const sampleSizes = [1, 20, 100].filter(size => size <= analytics.assetCount);
const lookups = sampleSizes.map(size => {
  const ownedAssetIds = analytics.indexes.assetIds.filter((_, index) => index % Math.max(1, Math.floor(analytics.assetCount / size)) === 0).slice(0, size);
  const durations = [];
  let result;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now();
    result = buildOwnerAnalytics(ownedAssetIds, analytics);
    durations.push(performance.now() - started);
  }
  durations.sort((left, right) => left - right);
  return {
    ownedAssets: size,
    p50Milliseconds: Number(percentile(durations, 0.5).toFixed(3)),
    p95Milliseconds: Number(percentile(durations, 0.95).toFixed(3)),
    maximumMilliseconds: Number(durations.at(-1).toFixed(3)),
    pairingsFound: Object.keys(result.pairCounts).length,
  };
});

const rawBytes = Buffer.byteLength(analyticsBody);
const gzipBytes = gzipSync(analyticsBody).byteLength;
process.stdout.write(`${JSON.stringify({
  snapshotId: analytics.snapshotId,
  rulesVersion: analytics.rulesVersion,
  assetCount: analytics.assetCount,
  rawBytes,
  gzipBytes,
  targetBytes: 2 * 1024 * 1024,
  underTarget: gzipBytes <= 2 * 1024 * 1024,
  iterations,
  lookups,
}, null, 2)}\n`);
if (gzipBytes > 2 * 1024 * 1024) process.exitCode = 2;
