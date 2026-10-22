import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertAnalyticsReconciles } from '../src/analytics.js';
import { assertSnapshotManifest } from '../src/contracts.js';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const r2Directory = resolve(argument('--r2', '.data/publication-story8/r2'));
const analyticsPath = resolve(argument('--analytics', '.data/full-bootstrap-ordered/analytics.json'));
const outputDirectory = resolve(argument('--output', '.data/analytics-release'));
const now = new Date().toISOString();
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const jsonBytes = value => Buffer.from(`${JSON.stringify(value)}\n`);
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const writeObject = async (key, value) => {
  const path = join(outputDirectory, key);
  const bytes = jsonBytes(value);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return { key, sha256: sha256(bytes), bytes: bytes.byteLength, path };
};

const pointer = await readJson(join(r2Directory, 'latest.json'));
const manifest = assertSnapshotManifest(await readJson(join(r2Directory, pointer.manifestKey)));
const canonicalArtifact = manifest.artifacts.find(artifact => artifact.kind === 'canonical');
if (!canonicalArtifact) throw new TypeError('The active manifest has no canonical artifact');
const canonical = await readJson(join(r2Directory, canonicalArtifact.key));
const analytics = await readJson(analyticsPath);
assertAnalyticsReconciles(canonical, analytics);
if (analytics.snapshotId !== pointer.snapshotId || analytics.assetCount !== manifest.actualCount) {
  throw new TypeError('The replacement analytics do not match the active canonical snapshot');
}

const safeRulesVersion = analytics.rulesVersion.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
const analyticsKey = `snapshots/${pointer.snapshotId}/analytics/${safeRulesVersion}.json`;
const analyticsArtifact = { kind: 'analytics', ...await writeObject(analyticsKey, analytics) };
delete analyticsArtifact.path;
const releaseManifest = assertSnapshotManifest({
  ...manifest,
  generatedAt: now,
  artifacts: manifest.artifacts.map(artifact => artifact.kind === 'analytics' ? analyticsArtifact : artifact),
});
const manifestKey = `snapshots/${pointer.snapshotId}/manifests/${safeRulesVersion}.json`;
const manifestArtifact = await writeObject(manifestKey, releaseManifest);
const historyKey = `pointers/history/${now}-${pointer.snapshotId}.json`;
await writeObject(historyKey, pointer);
const nextPointer = {
  ...pointer,
  manifestKey,
  activatedAt: now,
  previousManifestKey: pointer.manifestKey,
};
await writeObject('latest.json', nextPointer);

process.stdout.write(`${JSON.stringify({
  snapshotId: pointer.snapshotId,
  rulesVersion: analytics.rulesVersion,
  analytics: analyticsArtifact,
  manifest: { key: manifestArtifact.key, sha256: manifestArtifact.sha256, bytes: manifestArtifact.bytes },
  historyKey,
  pointer: nextPointer,
  outputDirectory,
})}\n`);
