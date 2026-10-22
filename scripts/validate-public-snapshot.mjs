import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { snapshotItems } from '../src/data.js';
import { collectionSummary, explore, traitOptionCounts } from '../src/explorer.js';
import { assertPublicCollectionSnapshot, toPublicCollectionSnapshot } from '../src/public-snapshot.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const input = resolve(argument('--input', '.data/full-bootstrap-story8/collection.candidate.json'));
const pointerPath = resolve(argument('--pointer', '.data/publication-story8/r2/latest.json'));
const [canonical, pointer] = await Promise.all([
  readFile(input, 'utf8').then(JSON.parse),
  readFile(pointerPath, 'utf8').then(JSON.parse),
]);
if (canonical.snapshotId !== pointer.snapshotId) throw new TypeError('Canonical input and active pointer identify different snapshots');

const started = performance.now();
const publicSnapshot = toPublicCollectionSnapshot(canonical, { activatedAt: pointer.activatedAt });
assertPublicCollectionSnapshot(publicSnapshot);
const items = snapshotItems(publicSnapshot);
const projectionMs = performance.now() - started;
const encoded = JSON.stringify(publicSnapshot);
const gzipBytes = gzipSync(encoded).byteLength;
const counts = traitOptionCounts(items);
const summary = collectionSummary(items, publicSnapshot.expectedCount);
if (summary.titans !== 6500 || summary.percentage !== '100.00%') throw new TypeError('Collection summary does not reconcile to the complete snapshot');
if (Object.values(counts.Class ?? {}).reduce((total, count) => total + count, 0) !== 6500) throw new TypeError('Class filter counts do not reconcile');
if (gzipBytes > 2 * 1024 * 1024) throw new TypeError('Public collection payload exceeds the 2 MiB gzip budget');

const samples = [];
for (let index = 0; index < 100; index += 1) {
  const benchmarkStart = performance.now();
  const result = index % 2
    ? explore(items, { query: 'Edward', sort: 'asc' })
    : explore(items, { traits: { Class: 'Military' }, sort: 'desc' });
  if (!result.length) throw new TypeError('Explorer benchmark unexpectedly returned no results');
  samples.push(performance.now() - benchmarkStart);
}
samples.sort((left, right) => left - right);
const p95Ms = samples[Math.floor(samples.length * 0.95)];

process.stdout.write(`${JSON.stringify({
  snapshotId: publicSnapshot.snapshotId,
  assets: publicSnapshot.assetCount,
  classes: counts.Class,
  traitCategories: Object.keys(counts).length,
  rawBytes: Buffer.byteLength(encoded),
  gzipBytes,
  projectionMs: Number(projectionMs.toFixed(3)),
  explorerP95Ms: Number(p95Ms.toFixed(3)),
  initialRenderLimit: 48,
}, null, 2)}\n`);
